import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Limit, Snap, View } from '../types'

const snap = atom({ plugin: 'pulse-bar', key: 'snap' } as const, { tokens: 0, window: 0, percent: 0, five: null, week: null } as Snap)
const view = atom({ plugin: 'pulse-bar', key: 'view' } as const, 'five' as View)
const tick = atom({ plugin: 'pulse-bar', key: 'tick' } as const, 0)

const CELL = '▃'
// remaining fraction -> color: red (low) -> orange -> green (plenty)
const STOPS: [number, [number, number, number]][] = [
  [0, [239, 68, 68]],
  [0.15, [239, 68, 68]],
  [0.4, [245, 158, 11]],
  [0.65, [34, 197, 94]],
  [1, [34, 197, 94]],
]

export function mix(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => v + (b[i]! - v) * t)
}

export function baseColor(left: number): number[] {
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, c1] = STOPS[i]!
    const [x0, c0] = STOPS[i - 1]!
    if (left <= x1) return x1 === x0 ? c1 : mix(c0, c1, (left - x0) / (x1 - x0))
  }
  return STOPS[STOPS.length - 1]![1]
}

export function hex(c: number[]): string {
  return '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

export function fmt(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`
}

const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const two = (n: number) => String(n).padStart(2, '0')
export function resetText(iso: string | null, weekly: boolean): string {
  const d = new Date(iso ?? NaN)
  if (isNaN(d.getTime())) return ''
  return (weekly ? DAYS[d.getDay()] + ' ' : '') + two(d.getHours()) + ':' + two(d.getMinutes())
}
const left = (used: number) => Math.max(0, Math.min(1, 1 - used / 100))

// One bar + text. The glyph is drawn two columns wide but measured as one: reserve both so nothing overlaps.
function item(Box: any, Text: any, t: number, key: string, remaining: number, pct: string, label: string, width: number, pad: number) {
  const base = baseColor(remaining)
  const lit = Math.max(1, Math.round(remaining * width))
  const breath = 0.5 + 0.5 * Math.sin(t / 2.2)
  const cells = []
  for (let i = 0; i < width; i++) {
    if (i >= lit) {
      cells.push(<Text key={i} color="#3f3f46">{CELL}</Text>)
      continue
    }
    // urgent: whole bar breathes; otherwise a bright wave runs along it
    const wave = Math.max(0, Math.cos((i - t * 0.9) * 0.45)) ** 6
    const glow = remaining < 0.15 ? breath * 0.55 : wave * 0.6
    cells.push(<Text key={i} color={hex(mix(base, [255, 255, 255], glow))}>{CELL}</Text>)
  }
  return (
    <Box key={key} flexDirection="row" gap={1}>
      <Box width={width * 2} flexShrink={0}><Text>{cells}</Text></Box>
      <Box width={pad} flexShrink={0}><Text color={hex(base)} bold>{pct}</Text></Box>
      <Text dimColor>{label}</Text>
    </Box>
  )
}

// h 0-360, s/l 0-1 -> rgb 0-255
export function hsl(h: number, sat: number, l: number): number[] {
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(l, 1 - l)
  return [0, 8, 4].map(n => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const u = await $.session.usage()
    const fresh = pick(u.context, u.rateLimits)
    // a new chat has no limit reading until its first reply: show the last one seen in any chat
    if (!fresh.five) fresh.five = restore((await $.store.get('five')) as Limit | undefined, await $.clock.now())
    if (!fresh.week) fresh.week = restore((await $.store.get('week')) as Limit | undefined, await $.clock.now())
    await update($, snap, () => fresh)
    // ~7 fps: enough for a smooth shimmer, cheap to redraw
    $.ui.status(undefined)
    await $.ui.close({ id: 'pulse-bar' })
    const saved = await $.store.get('view')
    if (saved === 'five' || saved === 'week') await update($, view, () => saved)
    await $.command.register({ name: 'limit', description: 'Полоска внизу: 5 часов или неделя (/limit 5ч, /limit неделя, без аргумента — переключить)' })
    $.clock.every(140, () => update($, tick, n => n + 1))
    return result
  })

  on('session.measure', async ($, e, next) => {
    const fresh = pick(e.context, e.rateLimits)
    if (fresh.five) await $.store.set('five', fresh.five)
    if (fresh.week) await $.store.set('week', fresh.week)
    await update($, snap, old => ({ ...fresh, five: fresh.five ?? old.five, week: fresh.week ?? old.week }))
    return next(e)
  })

  // Footer slot is ~20 columns and one row: the 5-hour limit only, compact.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const modes = await next(e)
    const s = await read($, snap)
    const v = await read($, view)
    // no reading yet (fresh chat, nothing stored): still show the bar, empty, so it is always there
    const l = (v === 'week' ? s.week : s.five) ?? { used: 0, resetsAt: null }
    const t = await read($, tick)
    const { Box, Text, Button } = $.ui.resolve(e)
    const r = left(l.used)
    return (
      <Box flexDirection="row" flexGrow={1} justifyContent="space-between" gap={3}>
        <Box flexDirection="row" gap={1}>
          {item(Box, Text, t, v, r, `${Math.round(l.used)}%`, '', 6, 4)}
          {/* the desktop draws a Button natively and ignores colours inside it, so the neon face is plain Text and only the arrow is a button */}
          <Text bold color="#22e5f0" backgroundColor="#0b1a1f">{' '}{v === 'week' ? `${resetText(l.resetsAt, true) || 'неделя'}` : `5ч ${resetText(l.resetsAt, false)}`}{' '}</Text>
          <Button
            key="pulse-bar-switch"
            plain
            label="⇄"
            onPress={async () => {
              const nv = pickView('', v)
              await update($, view, () => nv)
              await $.store.set('view', nv)
            }}
          />
        </Box>
        {modes}
      </Box>
    )
  })




  on('command.run', { command: 'limit' }, async ($, e) => {
    const next = pickView(e.args, await read($, view))
    await update($, view, () => next)
    await $.store.set('view', next)
    return { text: next === 'week' ? 'Внизу теперь недельный лимит (все модели).' : 'Внизу теперь лимит на 5 часов.' }
  })
}

// "/limit" toggles; "/limit 5ч" or "/limit неделя" picks.
export function pickView(args: string, current: View): View {
  const a = args.trim().toLowerCase()
  if (/^(5|5ч|5h|час|five)/.test(a)) return 'five'
  if (/^(нед|week|7|w)/.test(a)) return 'week'
  return current === 'five' ? 'week' : 'five'
}

function pick(c: { tokens?: number; window: number; percent?: number }, limits: { kind: string; percentUsed: number; resetsAt?: string }[]): Snap {
  const get = (k: string): Limit | null => {
    const l = limits.find(x => x.kind === k)
    return l ? { used: l.percentUsed, resetsAt: l.resetsAt ?? null } : null
  }
  return { tokens: c.tokens ?? 0, window: c.window, percent: c.percent ?? 0, five: get('five_hour'), week: get('seven_day') }
}

// A saved reading whose window already reset means the limit is back to zero.
export function restore(saved: Limit | undefined, nowMs: number): Limit | null {
  if (!saved) return null
  return saved.resetsAt && Date.parse(saved.resetsAt) <= nowMs ? { used: 0, resetsAt: null } : saved
}
