# Bitume

A pixel-art city living behind your Claude Code conversation, in the desktop app.
Top-down urban grit meets a cozy oblique RPG angle: shops, street lamps, a diagonal
street, pedestrians, and traffic that reacts to what Claude is doing.

## What happens on the street

| When… | You see |
|---|---|
| A tool call fails | ★★ A police chase: getaway car, two cruisers with flashing lights, a helicopter shadow |
| You run tests (`npm test`, `pytest`, `vitest`…) | 🏁 Two F1 cars tear down the avenue, checkered flags out |
| You `git commit` or `git push` | An armoured van under police escort |
| Claude makes 10+ tool calls in a turn | Rush hour, buses included |
| Every 2 minutes, at random | A rare F1 (3%) or an ambulance |
| You click the bare city | Something happens |

- **Day and night** follow the app's light/dark mode: lit windows, lamp glow, headlights.
- **Real time of day**: busier at rush hours (7–10h, 17–20h), nearly empty after 1am.
- **A matching color theme**, monospace headings and tool rows.
- **Sound** (turn it on with the speaker in the title bar): a low traffic rumble, distant horns, 8-bit blips.
- **`/ville <event>`** triggers an event by hand: `calme`, `pointe`, `poursuite`, `f1`, `convoi`, `ambulance`.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install bitume --marketplace alexisdelestre/GTA-in-Claude
```

Answer `y` to add the marketplace, then pick a scope (user scope makes it load everywhere).

From a shell:

```bash
claude plugin install bitume --marketplace alexisdelestre/GTA-in-Claude
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then
**Plugins**, **Add marketplace** with `alexisdelestre/GTA-in-Claude`, then **Add plugin**.

The scene draws in the Claude desktop and mobile apps; terminals show the rest of the theme only.

Original pixel art, inspired by the spirit of 90s top-down and oblique-view games.
Not affiliated with or endorsed by any game publisher.
