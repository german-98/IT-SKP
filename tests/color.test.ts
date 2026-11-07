import { baseColor, hex, fmt, restore, pickView, hsl } from '../hooks/register'
import { test, expect } from 'claude-code/testing'

test('colors by remaining', () => {
  expect(hex(baseColor(0.9))).toBe('#22c55e')
  expect(hex(baseColor(0.05))).toBe('#ef4444')
  expect(hex(baseColor(0.4))).toBe('#f59e0b')
  expect(fmt(182000)).toBe('182k')
})

test('restore saved 5h limit', () => {
  const now = Date.parse('2026-11-07T12:00:00Z')
  expect(restore(undefined, now)).toBe(null)
  expect(restore({ used: 13, resetsAt: '2026-11-07T14:00:00Z' }, now)?.used).toBe(13)
  expect(restore({ used: 13, resetsAt: '2026-11-07T10:00:00Z' }, now)?.used).toBe(0)
})

test('limit view picker', () => {
  expect(pickView('', 'five')).toBe('week')
  expect(pickView('', 'week')).toBe('five')
  expect(pickView('5ч', 'week')).toBe('five')
  expect(pickView('неделя', 'five')).toBe('week')
})

test('hsl primaries', () => {
  expect(hex(hsl(0, 1, 0.5))).toBe('#ff0000')
  expect(hex(hsl(240, 1, 0.5))).toBe('#0000ff')
})
