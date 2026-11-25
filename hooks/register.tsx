import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { ALT, buildScene, type EventKind } from './scene'

// Asphalt and sidewalk by day, sodium-lit asphalt by night.
const { theme, problems } = makeColors({
  label: 'Bitume',
  roles: { accent: '#d9a21b', danger: '#d23c3c', success: '#5fae3a', warning: '#e07b1a', pro: '#7d5bc2' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#e2dcc6',
        'surface-1': '#ebe6d4',
        'surface-2': '#f3f0e4',
        'text-primary': '#24212d',
        'text-secondary': '#4a4557',
        'text-muted': '#605a6e',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#16141e',
        'surface-1': '#1e1b28',
        'surface-2': '#262231',
        'surface-3': '#2c2839',
        'text-primary': '#ece8f5',
        'text-secondary': '#c6c0d6',
        'text-muted': '#a49eb5',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'ville' },
  sound: {
    ambience: {
      layers: [
        { wave: 'brown', drone: true, gain: 0.12, filter: { type: 'lowpass', hz: 260, to: 420 } },
        { wave: 'square', scatter: 0.03, notes: ['A3', 'C4', 'F3'], gain: 0.04, attack: 0.01, release: 0.35, filter: { type: 'lowpass', hz: 900 } },
      ],
    },
    cues: {
      send: { layers: [{ wave: 'square', notes: ['E5'], gain: 0.12, release: 0.08, filter: { type: 'lowpass', hz: 2400 } }] },
      done: { layers: [{ wave: 'square', notes: ['C5', 'G5'], step: 0.09, gain: 0.12, release: 0.12, filter: { type: 'lowpass', hz: 2400 } }] },
      error: { layers: [{ wave: 'triangle', notes: ['A4', 'E5', 'A4'], step: 0.25, glide: 2, gain: 0.14, release: 0.25 }] },
    },
  },
  style: {
    Heading: { fontFamily: ['mono'] },
    UserMessage: { radius: 0, borderWidth: 2, borderColor: 'text-muted', backgroundColor: 'surface-2' },
    ToolUse: { fontFamily: ['mono'], radius: 0 },
  },
}

const TOAST: Partial<Record<EventKind, string>> = {
  poursuite: '★★ Poursuite en cours sur l’avenue',
  f1: '🏁 Des F1 sur l’avenue !',
  convoi: 'Convoi blindé sous escorte',
}

const KINDS: readonly EventKind[] = ['calme', 'pointe', 'poursuite', 'f1', 'convoi', 'ambulance']

const TESTS = /\b(test|tests|jest|vitest|pytest|mocha|cargo test|go test|playwright)\b/
const SHIP = /\bgit (push|commit)\b/

// Module state: what the street shows now. A reload starts it calm.
let kind: EventKind = 'calme'
let seed = 1
let gen = 0
let toolsThisTurn = 0

function setEvent($: EngineInterface, next: EventKind, ms = 0): void {
  kind = next
  seed = (seed * 48271 + gen + 7) % 2147483647
  gen++
  const mine = gen
  $.ui.invalidate('ui.render')
  const toast = TOAST[next]
  if (toast) $.ui.toast(toast)
  if (ms > 0) {
    void $.clock.after(ms, () => {
      if (gen === mine) setEvent($, 'calme')
    })
  }
}

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) $.ui.toast(unpainted)
    try {
      await $.theme.set(LOOK)
    } catch (error) {
      $.ui.log(String(error))
      const { sound: _s, style: _st, ...rest } = LOOK
      await $.theme.set(rest)
    }

    await $.command.register({
      name: 'ville',
      description: 'Lance un évènement dans la ville : calme, pointe, poursuite, f1, convoi, ambulance',
    })

    // Every two minutes, a chance of something on the street.
    void $.clock.every(120_000, () => {
      if (kind !== 'calme') return
      const roll = Math.random()
      if (roll < 0.03) setEvent($, 'f1', 45_000)
      else if (roll < 0.12) setEvent($, 'ambulance', 30_000)
      else setEvent($, 'calme')
    })

    return next(e)
  })

  on('command.run', { command: 'ville' }, async ($, e) => {
    const asked = e.args.trim().toLowerCase() as EventKind
    if (!KINDS.includes(asked)) {
      return { text: `Évènements : ${KINDS.join(', ')}. Exemple : /ville poursuite` }
    }
    setEvent($, asked, asked === 'calme' ? 0 : 60_000)
    return { text: `La ville passe en mode « ${asked} ».` }
  })

  on('turn.start', ($, e, next) => {
    toolsThisTurn = 0
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (kind === 'pointe' && !e.agentId) {
      const mine = gen
      void $.clock.after(45_000, () => {
        if (gen === mine) setEvent($, 'calme')
      })
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    toolsThisTurn++
    const failed = 'isError' in ran && ran.isError === true

    if (failed) {
      if (kind !== 'poursuite') setEvent($, 'poursuite', 60_000)
      return ran
    }
    if (e.tool === 'Bash') {
      const cmd = String(e.command ?? '')
      if (TESTS.test(cmd)) {
        setEvent($, 'f1', 40_000)
        return ran
      }
      if (SHIP.test(cmd)) {
        setEvent($, 'convoi', 50_000)
        return ran
      }
    }
    if (toolsThisTurn === 10 && kind === 'calme') setEvent($, 'pointe')
    return ran
  })

  // A click on the bare city: a random happening.
  on('ui.pointer', ($, e, next) => {
    if (kind === 'calme') setEvent($, Math.random() < 0.15 ? 'f1' : 'ambulance', 30_000)
    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    if (e.props.plugin !== 'bitume') return next(e)
    const { Svg } = $.ui.resolve(e)
    const hour = new Date(await $.clock.now()).getHours()
    return <Svg source={buildScene({ kind, seed, hour })} alt={ALT[kind]} isInteractive />
  })
}
