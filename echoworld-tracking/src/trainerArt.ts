export const palettes = {
  Scarlet: { jacket: '#e83d36', shadow: '#a71f31', light: '#ff6250' },
  Teal: { jacket: '#119784', shadow: '#076759', light: '#42c5ac' },
  Violet: { jacket: '#7655c5', shadow: '#53358d', light: '#a187ea' },
}

export type Palette = typeof palettes.Scarlet
export type Pixel = { x: number; y: number }
type Face = { tilt: number; turn: number; left: number; right: number; mouth: number; smile: number }

const ink = '#161b2b'
const skin = '#e8a374'
const white = '#f7f5f0'

function shape(ctx: CanvasRenderingContext2D, path: string, fill: string, outline?: string) {
  const region = new Path2D(path)
  ctx.fillStyle = fill
  ctx.fill(region)
  if (outline) {
    ctx.strokeStyle = outline
    ctx.lineWidth = 1.5
    ctx.stroke(region)
  }
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI)
  ctx.fillStyle = color
  ctx.fill()
}

export function drawLimb(ctx: CanvasRenderingContext2D, from: Pixel, to: Pixel, style: 'sleeve' | 'forearm' | 'thigh' | 'shin', palette: Palette) {
  const dx = to.x - from.x, dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 1) return
  const widths = { sleeve: [15, 12], forearm: [10, 7], thigh: [17, 13], shin: [13, 8] }
  const [top, bottom] = widths[style]
  ctx.save()
  ctx.translate(from.x, from.y)
  ctx.rotate(Math.atan2(-dx, dy))
  const base = style === 'sleeve' ? white : style === 'forearm' ? skin : '#242a3b'
  const shade = style === 'sleeve' ? '#d7dce1' : style === 'forearm' ? '#c87955' : '#151a28'
  shape(ctx, `M${-top} 2 Q${-top} -9 0 -9 Q${top} -9 ${top} 1 L${bottom} ${length} Q0 ${length + 8} ${-bottom} ${length}Z`, base, ink)
  shape(ctx, `M${top - 6} 0 L${top - 1} 0 L${bottom - 1} ${length} Q${bottom - 4} ${length + 2} ${bottom - 6} ${length}Z`, shade)
  if (style === 'sleeve') {
    shape(ctx, `M${-top + 4} -2 L${-top + 7} -2 L${-bottom + 6} ${length - 2} L${-bottom + 3} ${length - 2}Z`, palette.jacket)
    shape(ctx, `M${-bottom - 1} ${length - 6} L${bottom + 1} ${length - 6} L${bottom + 1} ${length + 2} Q0 ${length + 6} ${-bottom - 1} ${length + 2}Z`, palette.jacket)
  }
  ctx.restore()
}

export function drawExtremity(ctx: CanvasRenderingContext2D, from: Pixel, to: Pixel, arm: boolean, screenSide: number) {
  ctx.save()
  ctx.translate(to.x, to.y)
  if (arm) {
    ctx.rotate(Math.atan2(from.x - to.x, to.y - from.y))
    shape(ctx, 'M-8 -7 Q0 -10 8 -7 L9 6 Q8 14 1 16 Q-7 16 -8 8 L-11 5 Q-13 0 -8 0Z', '#202736', ink)
    shape(ctx, 'M-7 -6 L7 -6 L8 -3 L-7 -3Z', '#4b8f81')
    shape(ctx, 'M-5 10 Q2 12 7 8 L6 13 Q1 17 -4 15Z', skin)
  } else {
    ctx.scale(screenSide, 1)
    shape(ctx, 'M-9 -9 L7 -9 Q10 0 16 6 Q22 11 18 17 L-10 17 Q-13 14 -12 9Z', '#262e40', ink)
    shape(ctx, 'M-12 12 Q2 14 19 12 L18 17 L-10 17Z', '#a9b0bf')
    shape(ctx, 'M1 -5 L6 -7 Q9 0 12 3 L8 5Z', '#449a82')
  }
  ctx.restore()
}

export function drawJacket(ctx: CanvasRenderingContext2D, from: Pixel, to: Pixel, width: number, palette: Palette) {
  const length = Math.max(22, Math.hypot(to.x - from.x, to.y - from.y))
  ctx.save()
  ctx.translate(from.x, from.y)
  ctx.rotate(Math.atan2(from.x - to.x, to.y - from.y))
  ctx.scale(width / 90, length / 80)
  shape(ctx, 'M-36 68 L36 68 L37 88 Q20 100 0 91 Q-21 100 -37 88Z', '#1c2232', ink)
  shape(ctx, 'M-18 -15 L18 -15 L22 5 L0 24 L-22 5Z', skin)
  shape(ctx, 'M-41 0 Q-31 -7 -21 -9 L21 -9 Q33 -7 41 0 L38 68 Q32 83 21 84 L-25 84 Q-37 81 -39 68Z', white, ink)
  shape(ctx, 'M-41 0 Q-31 -8 -21 -9 L17 -9 L38 2 Q20 15 8 41 Q-2 60 -13 83 L-26 83 Q-38 79 -39 68Z', palette.jacket)
  shape(ctx, 'M-39 50 Q-30 64 -28 82 L-16 83 L-8 65 L-22 71Z', palette.shadow)
  shape(ctx, 'M18 59 L32 56 L34 72 Q32 77 16 77 L7 68Z', '#dde0e4')
  shape(ctx, 'M-39 75 Q-18 85 36 74 L33 84 Q0 91 -34 83Z', '#34384a')
  shape(ctx, 'M-26 -8 Q-20 -17 -16 -15 Q-17 0 2 12 Q16 0 18 -15 Q26 -17 30 -7 L23 8 L2 25 L-18 9Z', '#3b4455', ink)
  shape(ctx, 'M-28 -5 L-17 0 L1 16 L23 1 L29 0 L21 11 L1 28 L-17 11Z', palette.light)
  shape(ctx, 'M-34 -3 Q-26 -8 -24 -5 Q-32 19 -30 53 L-36 60 Q-41 21 -34 -3Z', '#3d9b85')
  shape(ctx, 'M28 -5 L34 -3 Q39 13 39 28 L34 33 Q32 12 28 -5Z', '#287765')
  ctx.restore()
}

export function drawHead(ctx: CanvasRenderingContext2D, head: Pixel, face: Face, yaw: number) {
  ctx.save()
  ctx.translate(head.x, head.y - 12)
  ctx.rotate(face.tilt)
  const turn = Math.max(-1, Math.min(1, face.turn + Math.sin(yaw) * .6))
  ctx.scale(1 - Math.abs(turn) * .15, 1)
  shape(ctx, 'M-24 2 Q-32 -12 -20 -29 Q-4 -43 17 -32 L29 -36 L23 -27 L34 -27 L26 -17 Q32 -6 23 8Z', '#252432', ink)
  oval(ctx, -23, 2, 5, 7, skin)
  oval(ctx, 23, 2, 5, 7, skin)
  shape(ctx, 'M-22 -13 Q-19 -29 2 -27 Q20 -27 23 -12 L21 9 Q17 20 5 28 Q0 31 -6 27 Q-19 20 -22 7Z', '#f4bd91', '#a96850')
  shape(ctx, 'M-22 3 Q-12 21 0 24 Q7 25 20 11 Q15 22 5 28 Q0 31 -6 27 Q-19 20 -22 7Z', '#db976e')
  shape(ctx, 'M-27 -10 Q-30 -33 -6 -35 Q18 -41 29 -23 L27 -7 L20 -13 L17 -24 L10 -15 L10 -25 L0 -16 L-2 -22 L-14 -11 L-13 -22 L-22 -6Z', '#242330', ink)
  shape(ctx, 'M-26 -20 Q-20 -37 0 -35 Q17 -36 25 -24 Q10 -34 -5 -29 Q-18 -28 -26 -20Z', '#61636e')

  ctx.save()
  ctx.translate(turn * 8, 0)
  const eyes = [[-9, face.right], [9, face.left]]
  for (const [x, blink] of eyes) {
    const open = Math.max(.45, 3.3 * (1 - blink))
    shape(ctx, `M${x - 5} -8 Q${x} -11 ${x + 5} -8 L${x + 4} -7 Q${x} -8 ${x - 5} -6Z`, '#382630')
    oval(ctx, x, -2, 5.4, open, '#312630')
    if (open > 1) {
      oval(ctx, x, -1.6, 4.7, open * .78, '#fff5e9')
      oval(ctx, x + turn, -2, 2.3, open * .76, '#523b30')
      oval(ctx, x + turn + .6, -3, .65, .65, '#fff')
    }
  }
  shape(ctx, 'M0 0 L-2 8 L2 8Z', '#cc8869')
  const half = 4.5 + face.smile * 5
  const opening = 1 + face.mouth * 5
  shape(ctx, `M${-half} 13 Q0 ${15 - opening} ${half} 13 Q0 ${16 + opening + face.smile * 3} ${-half} 13Z`, '#6e3538')
  ctx.restore()
  ctx.restore()
}
