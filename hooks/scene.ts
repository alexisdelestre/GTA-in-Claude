// Draws the city as one SVG string: a pixel street seen from above at an
// oblique angle, with traffic that depends on the current event.

export type EventKind = 'calme' | 'pointe' | 'poursuite' | 'f1' | 'convoi' | 'nuit-calme' | 'ambulance'

export type SceneInput = { kind: EventKind; seed: number; hour: number }

const W = 480
const H = 270

// Avenue (horizontal) and the diagonal street, in viewBox pixels.
const AV_TOP = 150
const AV_BOT = 200
const LANE_W = 157 // westbound, cars face left
const LANE_E = 181 // eastbound, cars face right
const diagX = (y: number) => 330 + (270 - y) * 0.5 // centerline of the diagonal street

const rng = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CAR_COLORS = ['#c8323c', '#2f6fd0', '#e8c33a', '#3c9a4a', '#e07a2a', '#8a4fc0', '#e6e6e6', '#30333a', '#57c0c8', '#d0608e']

// 3x5 pixel font, enough letters for the shop signs.
const GLYPHS: Record<string, readonly string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
}

const glyphRows = (ch: string) => GLYPHS[ch] ?? ['...', '...', '...', '...', '...']

const word = (text: string, x: number, y: number, cls: string, scale = 1) => {
  let d = ''
  let cx = x
  for (const ch of text) {
    const rows = glyphRows(ch)
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < 3; rx++) {
        if (row[rx] === '#') {
          d += `M${cx + rx * scale} ${y + ry * scale}h${scale}v${scale}h-${scale}z`
        }
      }
    })
    cx += 4 * scale
  }
  return `<path class="${cls}" d="${d}"/>`
}

const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${fill.startsWith('.') ? `class="${fill.slice(1)}"` : `fill="${fill}"`}${extra}/>`

// Car seen from the side and a little above, facing right, 24x13.
const sideCar = (color: string, kind: 'car' | 'police' | 'taxi' | 'ambulance' = 'car') => {
  const body = kind === 'police' ? '#f2f2f2' : kind === 'ambulance' ? '#f4f4f0' : kind === 'taxi' ? '#f0c419' : color
  let s = ''
  s += rect(1, 11, 23, 2, '#0004')
  s += rect(0, 3, 24, 8, body)
  s += rect(0, 8, 24, 3, kind === 'police' ? '#202230' : '#0003')
  s += rect(6, 0, 12, 4, body)
  s += rect(7, 1, 4, 3, '#9fd3f0')
  s += rect(12, 1, 5, 3, '#7fb6dc')
  s += rect(3, 10, 4, 3, '#151515')
  s += rect(17, 10, 4, 3, '#151515')
  s += rect(23, 4, 1, 2, '#fff4b0')
  s += rect(0, 4, 1, 2, '#d22')
  s += `<polygon class="hl" points="24,4 44,0 44,11 24,7"/>`
  if (kind === 'police') {
    s += rect(7, -1, 5, 1, '#e11', ' class="br"')
    s += rect(12, -1, 5, 1, '#26f', ' class="bb"')
  }
  if (kind === 'ambulance') {
    s += rect(0, 6, 24, 2, '#d22')
    s += rect(10, -1, 4, 1, '#e11', ' class="br"')
  }
  if (kind === 'taxi') s += rect(10, -1, 4, 1, '#222')
  return s
}

// Long vehicles, facing right.
const bus = () =>
  rect(1, 14, 46, 2, '#0004') +
  rect(0, 1, 48, 13, '#2f8f5a') +
  rect(0, 10, 48, 4, '#1d6b40') +
  [3, 11, 19, 27, 35].map(x => rect(x, 3, 6, 4, '#a8dcf2')).join('') +
  rect(42, 3, 5, 6, '#a8dcf2') +
  rect(5, 13, 5, 3, '#151515') +
  rect(36, 13, 5, 3, '#151515') +
  `<polygon class="hl" points="48,6 66,2 66,14 48,10"/>`

const van = () =>
  rect(1, 13, 31, 2, '#0004') +
  rect(0, 1, 32, 12, '#7d848c') +
  rect(0, 9, 32, 4, '#565c63') +
  rect(26, 3, 5, 4, '#9fd3f0') +
  rect(6, 4, 14, 3, '#565c63') +
  rect(3, 12, 5, 3, '#151515') +
  rect(23, 12, 5, 3, '#151515') +
  `<polygon class="hl" points="32,5 50,1 50,12 32,8"/>`

const f1 = (color: string) =>
  rect(1, 11, 33, 2, '#0004') +
  rect(0, 2, 3, 7, color) +
  rect(3, 6, 28, 4, color) +
  rect(31, 7, 4, 3, color) +
  rect(14, 4, 6, 2, '#151515') +
  rect(15, 3, 3, 2, '#f5d90a') +
  rect(3, 4, 6, 7, '#151515') +
  rect(24, 5, 6, 6, '#151515') +
  rect(4, 5, 4, 1, '#555') +
  rect(25, 6, 4, 1, '#555')

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1, 7), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => c(v).toString(16).padStart(2, '0')).join('')
}

// Car seen from above, facing up, centered on 0,0, 12x20, in layers: each
// layer is drawn in the street's slant, then lifted straight up on screen so
// the car has sides and a raised cabin, like the buildings.
type Layer = { lift: number; shape: string }
const topCar = (color: string, police = false): Layer[] => {
  const body = police ? '#f2f2f2' : color
  const side = police ? '#202230' : shade(color, 0.6)
  const cab = police ? '#dcdcdc' : shade(color, 0.85)
  const wheels =
    rect(-7, -8, 2, 5, '#151515') + rect(5, -8, 2, 5, '#151515') +
    rect(-7, 3, 2, 5, '#151515') + rect(5, 3, 2, 5, '#151515')
  return [
    { lift: -3, shape: rect(-6, -10, 13, 21, '#0004') },
    { lift: 0, shape: wheels + rect(-6, -10, 12, 20, side) },
    { lift: 1, shape: rect(-6, -10, 12, 20, side) },
    {
      lift: 3,
      shape:
        rect(-6, -10, 12, 20, body) +
        rect(-6, -10, 12, 1, '#fff3') +
        rect(-5, -10, 2, 1, '#fff4b0') + rect(3, -10, 2, 1, '#fff4b0') +
        rect(-5, 9, 2, 1, '#d22') + rect(3, 9, 2, 1, '#d22') +
        `<polygon class="hl" points="-5,-10 -9,-26 9,-26 5,-10"/>`,
    },
    { lift: 4, shape: rect(-5, -6, 10, 11, shade(body === '#f2f2f2' ? '#9a9aa6' : body, 0.55)) },
    {
      lift: 6,
      shape:
        rect(-5, -6, 10, 11, cab) +
        rect(-5, -6, 10, 3, '#8cc6ea') +
        rect(-5, 3, 10, 2, '#6aa2c8') +
        (police ? rect(-5, -1, 5, 2, '#e11', ' class="br"') + rect(0, -1, 5, 2, '#26f', ' class="bb"') : ''),
    },
  ]
}

type Mover = { sprite: string; dur: number; delay: number }

// Horizontal traffic. Base positions sit off screen so a still scene shows
// only the parked cars.
const avenueCar = (m: Mover, dir: 'e' | 'w', lane: number, len = 24) => {
  const inner =
    dir === 'e'
      ? `<g transform="translate(-80 ${lane})">${m.sprite}</g>`
      : `<g transform="translate(${W + 80} ${lane}) scale(-1 1)">${m.sprite}</g>`
  void len
  return `<g class="m${dir}" style="animation-duration:${m.dur.toFixed(2)}s;animation-delay:-${m.delay.toFixed(2)}s">${inner}</g>`
}

const diagCar = (layers: Layer[], m: Omit<Mover, 'sprite'>, dir: 'u' | 'd') => {
  const y0 = dir === 'u' ? 300 : -40
  const x0 = diagX(y0) + (dir === 'u' ? 10 : -10)
  const rot = dir === 'u' ? '' : ' rotate(180)'
  const body = layers.map(l => `<g transform="translate(0 ${-l.lift}) skewX(-26.57)${rot}">${l.shape}</g>`).join('')
  return `<g class="m${dir}" style="animation-duration:${m.dur.toFixed(2)}s;animation-delay:-${m.delay.toFixed(2)}s"><g transform="translate(${x0} ${y0})">${body}</g></g>`
}

// One oblique building: facade, roof leaning up-right, side face.
type Building = { x: number; w: number; h: number; color: string; dark: string; roof: string; win: string; sign?: string; shop?: string }

const building = (b: Building, yb: number) => {
  const d = 14
  const s = 7
  const top = yb - b.h
  let out = ''
  out += `<polygon fill="${b.roof}" points="${b.x},${top} ${b.x + b.w},${top} ${b.x + b.w + s},${top - d} ${b.x + s},${top - d}"/>`
  out += rect(b.x + s + 3, top - d + 3, 8, 5, '#9a9aa6') + rect(b.x + s + 4, top - d + 2, 6, 1, '#b8b8c2')
  out += `<polygon fill="${b.dark}" points="${b.x + b.w},${top} ${b.x + b.w + s},${top - d} ${b.x + b.w + s},${yb - d} ${b.x + b.w},${yb}"/>`
  out += rect(b.x, top, b.w, b.h, b.color)
  out += rect(b.x, top, b.w, 2, '#fff2')
  out += rect(b.x + 3, top + 6, b.w - 6, b.h - 30, `url(#${b.win})`)
  if (b.shop) {
    out += rect(b.x + 2, yb - 22, b.w - 4, 4, b.shop)
    out += rect(b.x + 2, yb - 18, b.w - 4, 2, '#0003')
    out += rect(b.x + 6, yb - 15, b.w / 2 - 10, 11, '.win')
  }
  out += rect(b.x + b.w - 16, yb - 14, 9, 14, '#3a2a24')
  out += rect(b.x + b.w - 15, yb - 13, 7, 6, '#5a4a40')
  if (b.sign) {
    const tw = b.sign.length * 4 - 1
    const sx = Math.round(b.x + (b.w - tw) / 2)
    out += rect(sx - 3, top - 2 - 9, tw + 6, 9, '#22202c')
    out += word(b.sign, sx, top - 2 - 7, 'neon')
  }
  return out
}

const tree = (x: number, y: number) =>
  rect(x - 7, y + 6, 16, 4, '#0003') +
  rect(x - 1, y + 2, 3, 7, '#6b4a2c') +
  rect(x - 7, y - 8, 14, 10, '#3f8a3a') +
  rect(x - 5, y - 11, 10, 3, '#4fa046') +
  rect(x - 4, y - 7, 4, 3, '#63b85a') +
  rect(x - 7, y, 14, 2, '#2f6d2c')

const lamp = (x: number, y: number) =>
  `<circle class="glow" cx="${x + 1}" cy="${y - 12}" r="20" fill="url(#gl)"/>` +
  rect(x, y - 14, 2, 16, '#2f6b4a') +
  rect(x - 2, y - 17, 6, 4, '#3d8a60') +
  rect(x - 1, y - 16, 4, 2, '.bulb') +
  rect(x - 2, y + 1, 6, 2, '#0003')

const walker = (x: number, y: number, shirt: string, cls: string, dur: number) =>
  `<g class="${cls}" style="animation-duration:${dur}s"><g transform="translate(${x} ${y})">` +
  rect(0, 0, 3, 2, '#3a2a1e') +
  rect(0, 2, 3, 3, shirt) +
  `<g class="step">${rect(0, 5, 1, 2, '#2a2a3a')}${rect(2, 5, 1, 2, '#2a2a3a')}</g>` +
  rect(0, 7, 4, 1, '#0003') +
  `</g></g>`

const STYLE = `
.as{fill:#5c5a74}.as2{fill:#4e4c66}.ln{fill:#e6c34a}.wl{fill:#f4f1e6}
.swa{fill:#cdc59a}.swb{fill:#b9b083}.gr{fill:#8fbf6a}.gr2{fill:#7aad58}
.rf{fill:#6b6474}.win{fill:#6f8fb4}.wn{fill:#6f8fb4}.wl2{fill:#6f8fb4}
.neon{fill:#ff6fae}.bulb{fill:#f6f0c8}.glow{opacity:0}.hl{fill:#fff3a8;opacity:0}
.br,.bb{animation:blink 1s steps(1) infinite}.bb{animation-delay:-.5s}
.me,.mw,.mu,.md{animation-timing-function:linear;animation-iteration-count:infinite}
.me{animation-name:ge}.mw{animation-name:gw}.mu{animation-name:gu}.md{animation-name:gd}
.pw{animation:pw linear infinite}.pe{animation:pe linear infinite}
.step{animation:st .6s steps(1) infinite}
.tl1{animation:tl 12s steps(1) infinite}.tl2{animation:tl 12s steps(1) -8s infinite}
.heli{animation:heli 26s linear infinite}
@keyframes ge{from{transform:translateX(0)}to{transform:translateX(${W + 160}px)}}
@keyframes gw{from{transform:translateX(0)}to{transform:translateX(-${W + 160}px)}}
@keyframes gu{from{transform:translate(0,0)}to{transform:translate(170px,-340px)}}
@keyframes gd{from{transform:translate(0,0)}to{transform:translate(-170px,340px)}}
@keyframes pw{from{transform:translateX(0)}to{transform:translateX(-${W}px)}}
@keyframes pe{from{transform:translateX(0)}to{transform:translateX(${W}px)}}
@keyframes st{50%{transform:translateY(-1px)}}
@keyframes blink{0%{opacity:1}50%{opacity:.15}}
@keyframes tl{0%{opacity:1}33%{opacity:.2}}
@keyframes heli{from{transform:translate(-80px,240px)}to{transform:translate(560px,-60px)}}
@media (prefers-color-scheme: dark){
.as{fill:#2a2838}.as2{fill:#232130}.ln{fill:#b89a3a}.wl{fill:#b8b4c8}
.swa{fill:#4a4658}.swb{fill:#3e3a4c}.gr{fill:#2e4a34}.gr2{fill:#263f2c}
.rf{fill:#24212e}.win{fill:#f2c96a}.wn{fill:#232238}.wl2{fill:#ffd56e}
.neon{fill:#ff4fa0}.bulb{fill:#fff1a0}.glow{opacity:1}.hl{opacity:.35}}
`

export const buildScene = ({ kind, seed, hour }: SceneInput): string => {
  const r = rng(seed)
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!
  const p: string[] = []

  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">`)
  p.push(`<style>${STYLE}</style>`)
  p.push(
    `<defs>` +
      `<pattern id="sw" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" class="swa"/><rect width="10" height="1" class="swb"/><rect width="1" height="10" class="swb"/></pattern>` +
      `<pattern id="wa" width="12" height="14" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="7" height="8" class="wn"/><rect x="2" y="2" width="7" height="1" fill="#0003"/></pattern>` +
      `<pattern id="wb" width="24" height="14" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="8" height="9" class="wl2"/><rect x="14" y="2" width="8" height="9" class="wn"/><rect x="2" y="10" width="20" height="1" fill="#0002"/></pattern>` +
      `<pattern id="wc" width="36" height="16" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="5" height="10" class="wn"/><rect x="9" y="2" width="5" height="10" class="wl2"/><rect x="20" y="2" width="5" height="10" class="wn"/><rect x="27" y="2" width="5" height="10" class="wn"/></pattern>` +
      `<pattern id="rf" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" class="rf"/><rect x="3" y="4" width="6" height="4" fill="#0002"/><rect x="11" y="11" width="3" height="3" fill="#fff1"/></pattern>` +
      `<pattern id="chk" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#f4f4f4"/><rect width="2" height="2" fill="#151515"/><rect x="2" y="2" width="2" height="2" fill="#151515"/></pattern>` +
      `<radialGradient id="gl"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient>` +
      `</defs>`,
  )

  // Ground: rooftops far back, sidewalks, grass to the south.
  p.push(rect(0, 0, W, H, 'url(#rf)'))
  p.push(rect(0, 120, W, AV_TOP - 120, 'url(#sw)'))
  p.push(rect(0, AV_BOT, W, 14, 'url(#sw)'))
  p.push(rect(0, AV_BOT + 14, W, H - AV_BOT - 14, '.gr'))
  for (let i = 0; i < 40; i++) p.push(rect(Math.floor(r() * W), AV_BOT + 16 + Math.floor(r() * 50), 2, 1, '.gr2'))

  // Diagonal street with its sidewalks.
  const poly = (off0: number, off1: number, cls: string) =>
    `<polygon class="${cls}" points="${diagX(H) + off0},${H} ${diagX(H) + off1},${H} ${diagX(0) + off1},0 ${diagX(0) + off0},0"/>`
  p.push(poly(-28, 28, 'swa'))
  p.push(poly(-20, 20, 'as'))

  // Avenue.
  p.push(rect(0, AV_TOP, W, AV_BOT - AV_TOP, '.as'))
  p.push(rect(0, AV_TOP, W, 2, '.as2') + rect(0, AV_BOT - 2, W, 2, '.as2'))
  for (let x = 0; x < W; x += 20) p.push(rect(x, 175, 10, 1, '.ln'))
  p.push(`<line x1="${diagX(H)}" y1="${H}" x2="${diagX(AV_BOT)}" y2="${AV_BOT}" class="ln" stroke="#e6c34a" stroke-dasharray="6 8" shape-rendering="auto"/>`)
  p.push(`<line x1="${diagX(AV_TOP)}" y1="${AV_TOP}" x2="${diagX(0)}" y2="0" stroke="#e6c34a" stroke-dasharray="6 8" shape-rendering="auto"/>`)
  // Zebra crossing.
  for (let y = AV_TOP + 4; y < AV_BOT - 4; y += 6) p.push(rect(112, y, 22, 3, '.wl'))
  // Manhole.
  p.push(`<ellipse cx="60" cy="190" rx="7" ry="3" fill="#3a3850"/>`)

  // North block.
  const blocks: Building[] = [
    { x: 4, w: 66, h: 96, color: '#a4523e', dark: '#7a3a2c', roof: '#5e5566', win: 'wb', sign: 'HOTEL' },
    { x: 76, w: 58, h: 66, color: '#e8c95a', dark: '#b89a38', roof: '#6c6474', win: 'wa', sign: 'CAFE', shop: '#d94a3a' },
    { x: 140, w: 78, h: 112, color: '#8f97a8', dark: '#687082', roof: '#55505e', win: 'wc' },
    { x: 224, w: 54, h: 58, color: '#8a6fc0', dark: '#644e94', roof: '#6c6474', win: 'wa', sign: 'BAR', shop: '#3a2a6a' },
    { x: 284, w: 62, h: 84, color: '#c0785a', dark: '#94573e', roof: '#5e5566', win: 'wb', sign: 'TACOS', shop: '#2f8f5a' },
  ]
  for (const b of blocks) p.push(building(b, 134))

  // South side: a little house and trees.
  p.push(rect(150, 222, 52, 30, '#d8c8a8'))
  p.push(`<polygon fill="#b5523e" points="144,224 176,206 208,224"/>`)
  p.push(`<polygon fill="#8f3c2c" points="176,206 208,224 208,228 176,210"/>`)
  p.push(rect(170, 236, 10, 16, '#6b4a2c') + rect(156, 230, 9, 8, '.win') + rect(186, 230, 9, 8, '.win'))
  for (const [x, y] of [[40, 236], [80, 250], [110, 228], [240, 240], [280, 230], [420, 236], [455, 252], [395, 258]] as const) p.push(tree(x, y))

  // Street lamps and a traffic light.
  for (const x of [30, 98, 196, 262, 420]) p.push(lamp(x, 146))
  for (const x of [60, 150, 230, 300, 452]) p.push(lamp(x, 206))
  p.push(rect(358, 128, 2, 18, '#30303a') + rect(355, 116, 8, 14, '#22222c'))
  p.push(rect(357, 118, 4, 3, '#e23', ' class="tl1"') + rect(357, 125, 4, 3, '#3c3', ' class="tl2"'))

  // Parked cars (also what a still scene shows).
  p.push(`<g transform="translate(18 140)">${sideCar('#2f6fd0')}</g>`)
  p.push(`<g transform="translate(250 188)">${sideCar('#e07a2a')}</g>`)

  // Pedestrians on the sidewalks.
  const shirts = ['#d94a3a', '#2f6fd0', '#f0c419', '#3c9a4a', '#e6e6e6', '#8a4fc0']
  const nWalk = hour >= 1 && hour < 6 ? 2 : 6
  for (let i = 0; i < nWalk; i++) {
    const north = i % 2 === 0
    p.push(walker(Math.floor(r() * W), north ? 138 : 203, pick(shirts), r() < 0.5 ? 'pw' : 'pe', 50 + Math.floor(r() * 40)))
  }

  // Traffic, by event.
  const traffic: string[] = []
  const diagTraffic: string[] = []
  const mix = (n: number, dir: 'e' | 'w', durLo: number, durHi: number, kinds: ('car' | 'taxi' | 'bus')[]) => {
    for (let i = 0; i < n; i++) {
      const dur = durLo + r() * (durHi - durLo)
      const k = pick(kinds)
      const sprite = k === 'bus' ? bus() : sideCar(pick(CAR_COLORS), k === 'taxi' ? 'taxi' : 'car')
      traffic.push(avenueCar({ sprite, dur, delay: (i / n) * dur + r() * 1.5 }, dir, dir === 'e' ? LANE_E : LANE_W - (k === 'bus' ? 3 : 0)))
    }
  }
  const diag = (n: number, dur: number) => {
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? 'u' : 'd'
      diagTraffic.push(diagCar(topCar(pick(CAR_COLORS)), { dur: dur + r() * 3, delay: (i / n) * dur * 2 + r() }, dir))
    }
  }

  const late = hour >= 1 && hour < 6
  const rush = (hour >= 7 && hour < 10) || (hour >= 17 && hour < 20)
  const base = late ? 2 : rush ? 5 : 3

  switch (kind) {
    case 'pointe':
      mix(8, 'e', 16, 22, ['car', 'car', 'taxi', 'bus'])
      mix(8, 'w', 16, 22, ['car', 'car', 'taxi', 'bus'])
      diag(6, 12)
      break
    case 'poursuite': {
      mix(2, 'e', 11, 14, ['car', 'taxi'])
      mix(2, 'w', 11, 14, ['car'])
      const loop = 7
      traffic.push(avenueCar({ sprite: sideCar('#d8202a'), dur: loop, delay: 1.3 }, 'e', LANE_E))
      traffic.push(avenueCar({ sprite: sideCar('', 'police'), dur: loop, delay: 0.75 }, 'e', LANE_E))
      traffic.push(avenueCar({ sprite: sideCar('', 'police'), dur: loop, delay: 0.25 }, 'e', LANE_E))
      diagTraffic.push(diagCar(topCar('', true), { dur: 6, delay: 2 }, 'u'))
      p.push(`<g class="heli"><ellipse cx="0" cy="0" rx="14" ry="6" fill="#0003"/><circle cx="0" cy="-2" r="22" fill="#0001"/></g>`)
      break
    }
    case 'f1':
      mix(1, 'w', 12, 14, ['car'])
      traffic.push(avenueCar({ sprite: f1('#d8202a'), dur: 3.2, delay: 0 }, 'e', LANE_E))
      traffic.push(avenueCar({ sprite: f1('#1e5bd8'), dur: 3.4, delay: 1.6 }, 'e', LANE_E - 1))
      for (const x of [20, 180, 320, 440]) p.push(rect(x, 136, 10, 7, 'url(#chk)') + rect(x - 1, 136, 1, 12, '#30303a'))
      break
    case 'convoi': {
      mix(1, 'w', 12, 15, ['car'])
      const loop = 14
      traffic.push(avenueCar({ sprite: sideCar('', 'police'), dur: loop, delay: 1.4 }, 'e', LANE_E))
      traffic.push(avenueCar({ sprite: van(), dur: loop, delay: 0.7 }, 'e', LANE_E - 1))
      traffic.push(avenueCar({ sprite: sideCar('', 'police'), dur: loop, delay: 0 }, 'e', LANE_E))
      break
    }
    case 'ambulance':
      mix(base, 'e', 11, 16, ['car', 'taxi'])
      mix(base - 1, 'w', 11, 16, ['car', 'bus'])
      traffic.push(avenueCar({ sprite: sideCar('', 'ambulance'), dur: 6, delay: 2 }, 'w', LANE_W))
      break
    default:
      mix(base, 'e', 10, 16, ['car', 'car', 'taxi', 'bus'])
      mix(base, 'w', 10, 16, ['car', 'car', 'taxi'])
      diag(late ? 1 : 3, 9)
  }
  p.push(...diagTraffic)
  // East corner shop, past the diagonal.
  p.push(building({ x: 430, w: 46, h: 54, color: '#5fa0a8', dark: '#3f7a82', roof: '#6c6474', win: 'wa', sign: '24H', shop: '#e8c33a' }, 134))
  p.push(...traffic)

  p.push(`</svg>`)
  return p.join('')
}

export const ALT: Record<EventKind, string> = {
  calme: 'A pixel city street seen from above, cars driving by',
  'nuit-calme': 'A pixel city street at night, a few cars',
  pointe: 'Rush hour on a pixel city avenue, dense traffic and buses',
  poursuite: 'A police chase on a pixel city avenue, a helicopter overhead',
  f1: 'Two race cars speeding down a pixel city avenue',
  convoi: 'An armoured van escorted by police on a pixel avenue',
  ambulance: 'An ambulance crossing a pixel city avenue',
}
