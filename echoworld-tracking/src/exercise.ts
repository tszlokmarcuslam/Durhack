export type Exercise = 'free' | 'pushup' | 'pullup' | 'squat' | 'plank'
export type RepExercise = Exclude<Exercise, 'free' | 'plank'>
export type Point = { x: number; y: number; z?: number; visibility?: number }
type Motion = { height: number; length: number; side: number; anchor?: Point; allowDepthFallback?: boolean }
export type Sample = { valid: boolean; angle: number; extended: boolean; contracted: boolean; hint: string; motion?: Motion }
export const guides: Record<Exercise, string> = {
  free: 'Move freely. Keep your whole body in frame. The skeleton follows visible joints; no repetitions are counted.',
  pushup: 'Place the camera side-on near floor height with your shoulder, elbow and wrist in frame. Start with straight arms, lower, then press back up.',
  pullup: 'Use a fixed camera with a side or slight diagonal view. Keep your wrist, elbow and shoulder visible. Start with extended arms, pull up, then lower back down.',
  squat: 'Use a side or slight diagonal view with your hip, knee and ankle visible. Start standing, lower, then stand again.',
  plank: 'Place the camera side-on near floor height. Keep your shoulder, elbow or wrist, hip, knee and ankle in view. Use a forearm or straight-arm plank.',
}
export function visible(p: Point | undefined, confidence = .65): p is Point {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 0) >= confidence && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1
}
export function angle(a: Point, b: Point, c: Point, aspect: number) {
  return jointAngle(a, b, c, aspect, false)
}

function jointAngle(a: Point, b: Point, c: Point, aspect: number, useDepth: boolean) {
  const depth = (p: Point) => useDepth ? p.z ?? 0 : 0
  const u = [(a.x - b.x) * aspect, a.y - b.y, depth(a) - depth(b)]
  const v = [(c.x - b.x) * aspect, c.y - b.y, depth(c) - depth(b)]
  const length = Math.hypot(...u)*Math.hypot(...v)
  if (length < .00001) return NaN
  return Math.acos(Math.max(-1, Math.min(1, (u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/length)))*180/Math.PI
}
const bad = (hint: string): Sample => ({ valid: false, angle: 0, extended: false, contracted: false, hint })

function limbLength(a: Point, b: Point, c: Point, aspect: number) {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y) + Math.hypot((b.x - c.x) * aspect, b.y - c.y)
}

function trackedAngle(a: Point, b: Point, c: Point, aspect: number, world: Point[], indices: number[]) {
  const [upper, joint, lower] = indices.map(index => world[index])
  if ([upper, joint, lower].every(point => point && Number.isFinite(point.z))) {
    const degrees = jointAngle(upper, joint, lower, 1, true)
    if (Number.isFinite(degrees)) return degrees
  }
  return angle(a, b, c, aspect)
}

function measurePushup(points: Point[], side: number, aspect: number, world: Point[]): Sample {
  const [shoulder, elbow, wrist, hip] = [11, 13, 15, 23].map(index => points[index + side])
  if (![shoulder, elbow, wrist].every(point => visible(point, .45))) {
    return bad('Keep a shoulder, elbow and wrist visible on the side facing the camera.')
  }
  const degrees = trackedAngle(shoulder, elbow, wrist, aspect, world, [11 + side, 13 + side, 15 + side])
  if (!Number.isFinite(degrees)) return bad('Keep the tracked arm in view.')
  const length = limbLength(shoulder, elbow, wrist, aspect)
  const height = wrist.y - shoulder.y
  const sideOn = !visible(hip, .45) || Math.abs(shoulder.y - hip.y) <= Math.abs((shoulder.x - hip.x) * aspect) * 1.5 + .025
  return {
    valid: true, angle: degrees, extended: sideOn && height > .025 && (degrees >= 138 || height >= .90 * length), contracted: degrees <= 125,
    hint: sideOn ? `Tracking your ${side === 0 ? 'left' : 'right'} arm.` : 'Use a side-on plank to start.',
    motion: { height, length, side, anchor: wrist, allowDepthFallback: true },
  }
}

function measureSide(points: Point[], mode: RepExercise, side: number, aspect: number, world: Point[]): Sample {
  if (mode === 'pushup') return measurePushup(points, side, aspect, world)
  const isSquat = mode === 'squat'
  const indices = (isSquat ? [23, 25, 27] : [11, 13, 15]).map(index => index + side)
  const [upper, joint, lower] = indices.map(index => points[index])
  const limb = isSquat ? 'leg' : 'arm'
  if (![upper, joint, lower].every(point => visible(point, .5))) {
    return bad(isSquat ? 'Keep a hip, knee and ankle in view.' : 'Keep a shoulder, elbow and wrist in view.')
  }
  const degrees = isSquat ? trackedAngle(upper, joint, lower, aspect, world, indices) : angle(upper, joint, lower, aspect)
  if (!Number.isFinite(degrees)) return bad(`Keep the tracked ${limb} in view.`)

  const height = isSquat ? lower.y - upper.y : upper.y - lower.y
  const length = limbLength(upper, joint, lower, aspect)
  return {
    valid: true, angle: degrees,
    extended: height > .04 && (degrees >= 145 || (isSquat && height >= .92 * length)),
    contracted: degrees <= (isSquat ? 127 : 118),
    hint: `Tracking your ${side === 0 ? 'left' : 'right'} ${limb}.`,
    motion: { height, length, side, anchor: lower, allowDepthFallback: isSquat },
  }
}

export function measure(points: Point[], mode: RepExercise | 'free', side: number, aspect: number, lockedSide?: number, world: Point[] = []): Sample {
  if (mode === 'free') return bad(points.length ? 'Body detected - free movement' : 'Step into the camera view')
  const preferred = measureSide(points, mode, lockedSide ?? side, aspect, world)
  if (preferred.extended || lockedSide !== undefined) return preferred
  const other = measureSide(points, mode, 1 - side, aspect, world)
  return other.extended || (!preferred.valid && other.valid) ? other : preferred
}
// A rep starts extended, travels through the bent phase and returns to its start height.
export class RepCounter {
  count = 0
  phase: 'ready' | 'extended' | 'contracted' = 'ready'
  private startPose?: Motion
  private lastSeen = 0
  private started = 0
  private lowestHeight = 0

  get trackedSide() { return this.startPose?.side }

  depth(sample: Sample) {
    const baseline = this.startPose
    if (!baseline || !sample.motion || baseline.side !== sample.motion.side || baseline.length < .001) return null
    return Math.max(0, (baseline.height - sample.motion.height) / baseline.length)
  }

  resetPartial() {
    this.phase = 'ready'
    this.startPose = undefined
  }

  update(sample: Sample, now: number) {
    const lostAfter = this.startPose?.allowDepthFallback ? 650 : 350
    if (this.startPose && (now - this.lastSeen > lostAfter || now - this.started > 20000)) {
      this.resetPartial()
    }

    const pose = sample.motion
    if (!sample.valid || !pose) return
    this.lastSeen = now

    const start = this.startPose
    if (start && start.side !== pose.side) this.resetPartial()
    const anchorTolerance = pose.allowDepthFallback ? .11 : .08
    if (start?.anchor && pose.anchor && Math.hypot(pose.anchor.x - start.anchor.x, pose.anchor.y - start.anchor.y) > anchorTolerance) {
      this.resetPartial()
      return
    }

    if (this.phase === 'ready') {
      if (sample.extended) this.begin(pose, now)
      return
    }

    if (this.phase === 'extended') {
      const depth = this.depth(sample) ?? 0
      const lowered = (sample.contracted && depth >= .08) || (pose.allowDepthFallback && depth >= .20)
      if (lowered) {
        this.phase = 'contracted'
        this.lowestHeight = pose.height
      } else if (sample.extended && depth < .06) {
        this.started = now
        if (pose.height >= this.startPose!.height) this.startPose = pose
      }
      return
    }

    const baseline = this.startPose!
    this.lowestHeight = Math.min(this.lowestHeight, pose.height)
    const nearStart = pose.height >= baseline.height - .15 * baseline.length
    const returnedByHeight = pose.allowDepthFallback && (this.depth(sample) ?? 1) <= .09
    const hasRisen = pose.height - this.lowestHeight >= .08 * baseline.length
    if ((sample.extended || returnedByHeight) && nearStart && hasRisen && now - this.started >= 300) {
      this.count++
      this.begin(pose, now)
    }
  }

  private begin(pose: Motion, now: number) {
    this.startPose = pose
    this.phase = 'extended'
    this.started = now
  }
}
