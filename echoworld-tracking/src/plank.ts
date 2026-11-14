import { angle, visible } from './exercise.ts'
import type { Point } from './exercise.ts'

type Form = { kind: 'holding' | 'broken' | 'missing'; cue: string; confidence?: number }
const missing: Form = { kind: 'missing', cue: 'Keep your supporting arm and full body in view.' }

function measureSide(points: Point[], side: number, aspect: number): Form {
  const [shoulder, elbow, wrist, hip, knee, ankle] = [11, 13, 15, 23, 25, 27].map(index => points[index + side])
  if (![shoulder, hip, knee, ankle].every(point => visible(point, .48))) return missing
  const supports = [elbow, wrist].filter(point => visible(point, .48))
  if (!supports.length) return missing

  const confidence = Math.min(
    ...[shoulder, hip, knee, ankle].map(point => point.visibility ?? 0),
    Math.max(...supports.map(point => point.visibility ?? 0)),
  )
  const broken = (cue: string): Form => ({ kind: 'broken', cue, confidence })

  const span = (ankle.x - shoulder.x) * aspect
  const slope = ankle.y - shoulder.y
  if (Math.abs(span) < .14 || Math.abs(slope) > Math.abs(span) * .65) {
    return broken('Get into a plank with your body side-on to the camera.')
  }
  const supported = supports.some(point => point.y > shoulder.y + Math.abs(span) * .07 && Math.abs(point.x - shoulder.x) * aspect < Math.abs(span) * .35)
  if (!supported) return broken('Bring a wrist or elbow under your shoulder.')

  // Compare the hip and knee to the line between shoulder and ankle.
  const offset = (point: Point) => (point.y - shoulder.y - slope * (point.x - shoulder.x) * aspect / span) / Math.abs(span)
  const hipOffset = offset(hip)
  if (hipOffset > .075) return broken('Lift your hips back in line with your shoulders and ankles.')
  if (hipOffset < -.10) return broken('Lower your hips back in line with your shoulders and ankles.')
  if (offset(knee) > .10 || !(angle(hip, knee, ankle, aspect) >= 145)) {
    return broken('Extend your legs and lift your knees.')
  }
  return { kind: 'holding', cue: 'Hold this position.', confidence }
}

export function measurePlank(points: Point[], preferredSide: number, aspect: number): Form {
  const preferred = measureSide(points, preferredSide, aspect)
  const other = measureSide(points, 1 - preferredSide, aspect)
  if (preferred.kind === 'missing' || (other.confidence ?? 0) > (preferred.confidence ?? 0) + .12) return other
  return preferred
}

export class PlankTimer {
  elapsedMs = 0
  resets = 0
  notice = ''
  cue = 'Get into a plank to start the timer.'
  private running = false
  private stableMs = 0
  private interruption?: { since: number; reason: string }
  private lastFrame?: number
  private lastGood?: number

  checkTracking(now: number) {
    if (this.lastFrame === undefined || now - this.lastFrame <= 800) return false
    this.lastFrame = undefined
    this.stableMs = 0
    this.lastGood = undefined
    this.cue = missing.cue
    if (this.running) this.restart('Tracking lost')
    return true
  }

  update(form: Form, now: number) {
    this.checkTracking(now)
    // If the first recovered frame follows a sustained break, restart first.
    if (this.running && this.interruption && now - this.interruption.since >= 500) {
      this.restart(this.interruption.reason)
    }
    this.lastFrame = now
    this.cue = form.cue

    if (form.kind !== 'holding') {
      this.lastGood = undefined
      this.interruption ??= { since: now, reason: form.kind === 'broken' ? 'Plank form lost' : 'Tracking lost' }
      if (form.kind === 'broken' || now - this.interruption.since >= 300) this.stableMs = 0
      return
    }

    if (this.interruption && now - this.interruption.since >= 300) this.stableMs = 0
    this.interruption = undefined
    const verifiedMs = this.lastGood === undefined ? 0 : now - this.lastGood
    this.stableMs += verifiedMs
    if (!this.running && this.stableMs >= 350) {
      this.running = true
      this.elapsedMs = this.stableMs
      if (this.notice) this.notice = 'Form restored. A new hold is timing.'
    } else if (this.running) {
      this.elapsedMs += verifiedMs
    }
    this.lastGood = now
    if (!this.running) this.cue = 'Hold steady to start the timer.'
  }

  private restart(reason: string) {
    this.running = false
    this.elapsedMs = 0
    this.stableMs = 0
    this.interruption = undefined
    this.lastGood = undefined
    this.resets++
    this.notice = `${reason}. Timer restarted at 0:00. Return to a plank to start timing again.`
  }
}
