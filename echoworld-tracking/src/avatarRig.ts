import type { Point } from './exercise'

export type Vec = [number, number, number]
export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec, n: number): Vec => [a[0] * n, a[1] * n, a[2] * n]
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const mix = (a: Vec, b: Vec, t: number) => add(a, scale(sub(b, a), t))
export function unit(v: Vec, fallback: Vec): Vec {
  const length = Math.hypot(...v)
  return length > .0001 ? scale(v, 1 / length) : fallback
}

export function basis(up: Vec, right: Vec) {
  const front = unit(cross(right, up), [0, 0, 1])
  return { right: unit(cross(up, front), [1, 0, 0]), up, front }
}

const defaultUp: Vec = [0, 1, 0]
const defaultRight: Vec = [1, 0, 0]
const down: Vec = [0, -1, 0]
const forward: Vec = [0, 0, 1]

function landmark(points: Point[], index: number): Vec | undefined {
  const p = points[index]
  if (p?.z === undefined || (p.visibility ?? 0) < .5 || ![p.x, p.y, p.z].every(Number.isFinite)) return
  return [p.x, -p.y, -p.z]
}

function steer(current: Vec, target: Vec, amount: number) {
  const cosine = Math.max(-1, Math.min(1, dot(current, target)))
  if (cosine > .999) return unit(mix(current, target, amount), target)
  const axis = Math.abs(current[0]) < .8 ? defaultRight : defaultUp
  const tangent = unit(sub(target, scale(current, cosine)), unit(cross(current, axis), forward))
  const turn = Math.acos(cosine) * amount
  return add(scale(current, Math.cos(turn)), scale(tangent, Math.sin(turn)))
}

const definitions = [
  { arm: true, side: 1, ids: [11, 13, 15], tip: 19, lengths: [.239, .215] },
  { arm: true, side: -1, ids: [12, 14, 16], tip: 20, lengths: [.239, .215] },
  { arm: false, side: 1, ids: [23, 25, 27], tip: 31, lengths: [.335, .322] },
  { arm: false, side: -1, ids: [24, 26, 28], tip: 32, lengths: [.335, .322] },
]

export class AvatarRig {
  private up = defaultUp
  private shoulderAxis = defaultRight
  private hipAxis = defaultRight
  private limbs = definitions.map(({ arm, side }) => ({
    upper: unit([arm ? side * .17 : side * .06, -1, 0], down),
    lower: unit([arm ? side * .09 : 0, -1, arm ? .07 : 0], down),
    tip: arm ? down : forward,
  }))

  update(points: Point[], dt: number) {
    const amount = 1 - Math.exp(-dt / 90)
    const idle = 1 - Math.exp(-dt / 240)
    const hips = [landmark(points, 23), landmark(points, 24)]
    const shoulders = [landmark(points, 11), landmark(points, 12)]
    const hipMid = hips[0] && hips[1] ? mix(hips[0], hips[1], .5) : undefined
    const shoulderMid = shoulders[0] && shoulders[1] ? mix(shoulders[0], shoulders[1], .5) : undefined
    this.up = steer(this.up, hipMid && shoulderMid ? unit(sub(shoulderMid, hipMid), this.up) : defaultUp, hipMid && shoulderMid ? amount : idle)
    this.hipAxis = steer(this.hipAxis, hips[0] && hips[1] ? unit(sub(hips[0], hips[1]), this.hipAxis) : defaultRight, hipMid ? amount : idle)
    this.shoulderAxis = steer(this.shoulderAxis, shoulders[0] && shoulders[1] ? unit(sub(shoulders[0], shoulders[1]), this.shoulderAxis) : defaultRight, shoulderMid ? amount : idle)

    const torso = basis(this.up, this.shoulderAxis)
    const pelvis = basis(this.up, this.hipAxis)
    const shoulderCenter = scale(this.up, .395)
    const limbs = definitions.map(({ arm, side, ids, tip, lengths }, index) => {
      const [a, b, c] = ids.map(id => landmark(points, id))
      const end = landmark(points, tip)
      const direction = this.limbs[index]
      const upperRest = unit(add(scale(torso.up, -1), scale(torso.right, side * (arm ? .17 : .06))), down)
      const upper = a && b ? unit(sub(b, a), direction.upper) : upperRest
      const lower = b && c ? unit(sub(c, b), direction.lower) : upperRest
      direction.upper = steer(direction.upper, upper, a && b ? amount : idle)
      direction.lower = steer(direction.lower, lower, b && c ? amount : idle)
      direction.tip = steer(direction.tip, c && end ? unit(sub(end, c), direction.tip) : arm ? direction.lower : pelvis.front, c && end ? amount : idle)
      // Keep the bend finite when the two estimated segments fold back on themselves.
      const limit = arm ? 2.62 : 2.55
      const bend = Math.acos(Math.max(-1, Math.min(1, dot(direction.upper, direction.lower))))
      const lowerDirection = bend > limit ? steer(direction.upper, direction.lower, limit / bend) : direction.lower
      const start = add(arm ? shoulderCenter : [0, 0, 0], scale(arm ? torso.right : pelvis.right, side * (arm ? .146 : .087)))
      const joint = add(start, scale(direction.upper, lengths[0]))
      const finish = add(joint, scale(lowerDirection, lengths[1]))
      return { arm, start, joint, finish, tip: direction.tip }
    })
    return { torso, pelvis, limbs }
  }
}
