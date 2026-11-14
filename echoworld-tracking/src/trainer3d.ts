import { add, basis, cross, dot, scale, sub, unit } from './avatarRig'
import type { AvatarRig, Vec } from './avatarRig'

export const outfits = {
  Scarlet: [215, 45, 46],
  Teal: [18, 150, 133],
  Violet: [116, 79, 197],
} satisfies Record<string, Vec>

type Axes = ReturnType<typeof basis>
export type Expression = { tilt: number; turn: number; left: number; right: number; mouth: number; smile: number }
const skin: Vec = [235, 166, 117]
const hair: Vec = [40, 33, 36]
const white: Vec = [242, 241, 235]
const ink: Vec = [31, 37, 53]
const teal: Vec = [42, 128, 106]
const identity = basis([0, 1, 0], [1, 0, 0])
const light = unit([-.5, .8, .65], [0, 1, 0])
const around = Array.from({ length: 16 }, (_, i) => [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)])
const sphere = Array.from({ length: 11 }, (_, i) => {
  const t = i * Math.PI / 10
  return [Math.cos(t), Math.sin(t)]
})

function local(origin: Vec, axes: Axes, [x, y, z]: Vec) {
  return add(origin, add(scale(axes.right, x), add(scale(axes.up, y), scale(axes.front, z))))
}

export function renderTrainer(ctx: CanvasRenderingContext2D, rig: ReturnType<AvatarRig['update']>, face: Expression, jacket: Vec, yaw: number) {
  const { width, height } = ctx.canvas
  const center: Vec = [0, .04, 0]
  const camera = unit([Math.sin(yaw), .10, Math.cos(yaw)], [0, 0, 1])
  const horizontal: Vec = [Math.cos(yaw), 0, -Math.sin(yaw)]
  const vertical = cross(camera, horizontal)
  const zoom = height * .56
  const project = (v: Vec) => {
    const relative = sub(v, center)
    const z = dot(relative, camera)
    const perspective = 3.8 / (3.8 - z)
    return { x: width * .5 + dot(relative, horizontal) * zoom * perspective, y: height * .5 - dot(relative, vertical) * zoom * perspective, z }
  }
  type ScreenPoint = ReturnType<typeof project>
  const faces: { vertices: ScreenPoint[]; z: number; color: string }[] = []

  function mesh(origin: Vec, axes: Axes, size: Vec, color: Vec | ((x: number, y: number, z: number) => Vec), profile = sphere) {
    const rings = profile.map(([y, radius]) => around.map(([cos, sin]) => {
      const position: Vec = [cos * radius, y, sin * radius]
      return { position, projected: project(local(origin, axes, [position[0] * size[0], y * size[1], position[2] * size[2]])) }
    }))
    for (let row = 0; row < rings.length - 1; row++) {
      for (let col = 0; col < around.length; col++) {
        const next = (col + 1) % around.length
        const corners = [rings[row][col], rings[row][next], rings[row + 1][next], rings[row + 1][col]]
        const surface = scale(corners.reduce<Vec>((sum, point) => add(sum, point.position), [0, 0, 0]), .25)
        const normal = unit(local([0, 0, 0], axes, [surface[0] / size[0], surface[1] / size[1], surface[2] / size[2]]), axes.up)
        if (dot(normal, camera) < -.08) continue
        const shade = .63 + .40 * Math.max(0, dot(normal, light))
        const tone = typeof color === 'function' ? color(...surface) : color
        const vertices = corners.map(point => point.projected)
        const z = vertices.reduce((sum, point) => sum + point.z, 0) / 4
        faces.push({ vertices, z, color: `rgb(${tone.map(channel => Math.round(channel * shade)).join(',')})` })
      }
    }
  }

  function limb(from: Vec, to: Vec, width: number, depth: number, paint: Vec | ((x: number, y: number, z: number) => Vec), taper = .8) {
    const up = unit(sub(from, to), [0, 1, 0])
    const right = unit(cross(up, rig.torso.front), rig.torso.right)
    const length = Math.hypot(...sub(from, to))
    mesh(scale(add(from, to), .5), basis(up, right), [width, length / 2 + .024, depth], paint,
      [[1, .06], [.88, .76], [.46, 1], [-.25, .94], [-.82, taper], [-1, .06]])
  }

  const body = rig.torso
  mesh(scale(body.up, .195), body, [.158, .225, .087], (x, y, z) => {
    if (y < -.77) return ink
    if (z > .25 && Math.abs(x + .65) < .11 && y > -.42) return teal
    return x + y * .72 > .29 ? white : jacket
  }, [[1, .32], [.82, .87], [.55, 1], [.15, .93], [-.46, .78], [-.82, .81], [-1, .55]])
  mesh(scale(body.up, .368), body, [.100, .055, .078], ink)
  mesh(scale(body.up, .429), body, [.038, .061, .036], skin)
  mesh([0, -.022, 0], rig.pelvis, [.117, .087, .077], ink)

  for (const { arm, start, joint, finish, tip } of rig.limbs) {
    if (arm) {
      limb(start, joint, .048, .045, (x, y) => y < -.62 || x < -.82 ? jacket : white)
      mesh(joint, identity, [.032, .032, .032], skin)
      limb(joint, finish, .032, .031, skin, .63)
      limb(finish, add(finish, scale(tip, .074)), .029, .024, (x, y) => y < -.64 ? skin : x > .75 ? teal : ink)
    } else {
      limb(start, joint, .057, .056, ink, .77)
      mesh(joint, identity, [.043, .045, .043], ink)
      limb(joint, finish, .045, .040, ink, .63)
      const footForward = unit(sub(tip, scale(body.up, dot(tip, body.up) * .55)), body.front)
      const footRight = unit(cross(body.up, footForward), body.right)
      const footAxes = basis(unit(cross(footForward, footRight), body.up), footRight)
      mesh(add(finish, add(scale(footForward, .044), scale(body.up, -.018))), footAxes, [.039, .036, .087],
        (x, y, z) => y < -.48 ? [180, 185, 191] : z > .24 && y > .35 && Math.abs(x) < .65 ? teal : ink)
    }
  }

  const headCenter = scale(body.up, .538)
  const headRight = add(scale(body.right, Math.cos(face.turn)), scale(body.front, -Math.sin(face.turn)))
  const headAxes = basis(unit(add(scale(body.up, Math.cos(face.tilt)), scale(headRight, Math.sin(face.tilt))), body.up), headRight)
  const headPart = (position: Vec, size: Vec, color: Vec | ((x: number, y: number, z: number) => Vec)) =>
    mesh(local(headCenter, headAxes, position), headAxes, size, color)
  headPart([0, 0, 0], [.083, .107, .071], skin)
  headPart([0, .036, -.021], [.088, .094, .066], (x, y, z) => y < .27 && y > .07 && z > .28 && x < .25 ? [105, 108, 119] : hair)
  for (const side of [-1, 1]) {
    headPart([side * .079, -.008, -.002], [.014, .021, .012], skin)
    const x = side * .033
    const blink = side < 0 ? face.right : face.left
    const eyeHeight = Math.max(.0015, .009 * (1 - blink))
    headPart([x, .006, .064], [.016, eyeHeight, .004], blink > .8 ? hair : white)
    if (blink < .82) headPart([x, .006, .068], [.006, eyeHeight * .86, .002], [66, 44, 35])
    headPart([x, .022, .063], [.018, .003, .003], hair)
  }
  headPart([0, -.011, .071], [.008, .013, .007], [207, 137, 94])
  headPart([0, -.041, .065], [.015 + .006 * face.smile, .002 + .012 * face.mouth, .003], [115, 47, 52])
  for (const [x, y, z, sx, sy] of [[-.045, .064, .039, .035, .041], [-.008, .076, .046, .042, .030], [.033, .085, .036, .034, .026]]) {
    headPart([x, y, z], [sx, sy, .022], hair)
  }

  ctx.clearRect(0, 0, width, height)
  const shadow = project([0, -.716, 0])
  const gradient = ctx.createRadialGradient(shadow.x, shadow.y, 0, shadow.x, shadow.y, zoom * .24)
  gradient.addColorStop(0, '#0007')
  gradient.addColorStop(1, '#0000')
  ctx.save()
  ctx.translate(shadow.x, shadow.y)
  ctx.scale(1, .19)
  ctx.translate(-shadow.x, -shadow.y)
  ctx.fillStyle = gradient
  ctx.fillRect(shadow.x - zoom * .25, shadow.y - zoom * .25, zoom * .5, zoom * .5)
  ctx.restore()
  for (const { vertices, color } of faces.sort((a, b) => a.z - b.z)) {
    ctx.beginPath()
    ctx.moveTo(vertices[0].x, vertices[0].y)
    for (const point of vertices.slice(1)) ctx.lineTo(point.x, point.y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineWidth = .7
    ctx.stroke()
    ctx.fill()
  }
}
