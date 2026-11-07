# pulse-bar

An animated limit bar for Claude Code, under the prompt box. It shows how much of your 5-hour or weekly usage limit is spent, when the limit resets, and colours the bar by what is left: green when plenty remains, orange in the middle, red when it is nearly gone. A small ⇄ button switches between the 5-hour and the weekly limit; `/limit` does the same from the prompt.

Анимированная полоска лимита для Claude Code под полем ввода: сколько потрачено из лимита на 5 часов или на неделю, когда сброс, цвет по остатку (зелёный → оранжевый → красный). Кнопка ⇄ или команда `/limit` переключает 5 часов / неделя.

## Install

At the prompt of a terminal session:

```
/plugin install pulse-bar --marketplace german-98/IT-SKP
```

From a shell:

```
claude plugin install pulse-bar --marketplace german-98/IT-SKP
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `german-98/IT-SKP`, then Add plugin.

Restart the app afterwards so already open chats load it.
