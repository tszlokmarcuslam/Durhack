import assert from 'node:assert/strict'
import { test } from 'node:test'
import { measurePlank, PlankTimer } from './plank.ts'

function pose({ hip = .58, forearm = true } = {}) {
  const points = []
  for (const [index, x, y] of [[11, .23, .49], [forearm ? 13 : 15, .23, .70], [23, .49, hip], [25, .64, .665], [27, .79, .72]]) {
    points[index] = { x, y, visibility: .8 }
  }
  return points
}

const holding = measurePlank(pose(), 0, 4/3)
const collapsed = measurePlank(pose({ hip: .72 }), 0, 4/3)

test('recognizes both plank variants, sagging or raised hips, and missing landmarks', () => {
  assert.equal(holding.kind, 'holding')
  assert.equal(measurePlank(pose({ forearm: false }), 1, 4/3).kind, 'holding')
  assert.equal(collapsed.kind, 'broken')
  assert.match(measurePlank(pose({ hip: .45 }), 0, 4/3).cue, /Lower your hips/)
  assert.equal(measurePlank([], 0, 4/3).kind, 'missing')
})

test('brief bad frames freeze time without resetting, long form loss announces a restart', () => {
  const timer = new PlankTimer()
  for (const time of [0, 200, 400, 600]) timer.update(holding, time)
  assert.equal(timer.elapsedMs, 600)
  timer.update(collapsed, 700)
  timer.update(holding, 800)
  assert.equal(timer.elapsedMs, 600)
  timer.update(collapsed, 900)
  timer.update(collapsed, 1400)
  timer.update(collapsed, 1500)
  assert.equal(timer.elapsedMs, 0)
  assert.equal(timer.resets, 1)
  assert.match(timer.notice, /Plank form lost\. Timer restarted at 0:00/)
  for (const time of [1600, 1800, 2000]) timer.update(holding, time)
  assert.equal(timer.elapsedMs, 400)
  assert.match(timer.notice, /Form restored/)
})

test('correcting form while still in frame starts a new hold from zero each time', () => {
  const timer = new PlankTimer()
  const frame = (points, now) => timer.update(measurePlank(points, 0, 4/3), now)
  for (const now of [0, 200, 400]) frame(pose(), now)
  for (const start of [600, 2200]) {
    for (const offset of [0, 250, 500, 700]) frame(pose({ hip: .72 }), start + offset)
    assert.equal(timer.elapsedMs, 0)
    assert.match(timer.notice, /Timer restarted at 0:00/)
    frame(pose(), start + 800)
    frame(pose(), start + 1000)
    assert.equal(timer.elapsedMs, 0)
    frame(pose(), start + 1200)
    assert.equal(timer.elapsedMs, 400)
    frame(pose(), start + 1400)
    assert.equal(timer.elapsedMs, 600)
  }
  assert.equal(timer.resets, 2)
})

test('a worker stall clears the current hold and does not include unobserved time', () => {
  const timer = new PlankTimer()
  for (const time of [0, 200, 400]) timer.update(holding, time)
  assert.equal(timer.checkTracking(1300), true)
  assert.equal(timer.checkTracking(1400), false)
  assert.equal(timer.elapsedMs, 0)
  assert.match(timer.notice, /Tracking lost/)
  timer.update(holding, 1400)
  assert.equal(timer.elapsedMs, 0)
})

test('recovery continues through short landmark dropouts without counting missing time', () => {
  const timer = new PlankTimer()
  for (const now of [0, 200, 400]) timer.update(holding, now)
  timer.update(collapsed, 500)
  timer.update(collapsed, 1000)
  const missing = measurePlank([], 0, 4/3)
  for (const [form, now] of [[holding, 1100], [holding, 1200], [missing, 1300], [holding, 1400], [holding, 1500], [missing, 1600], [holding, 1700], [holding, 1900]]) {
    timer.update(form, now)
  }
  assert.equal(timer.elapsedMs, 400)
  assert.match(timer.notice, /Form restored/)
})

test('recovery can use the near side when the selected side has less reliable landmarks', () => {
  const points = pose({ hip: .72 })
  for (const [index, joint] of points.entries()) if (joint) points[index] = { ...joint, visibility: .5 }
  for (const [index, joint] of pose().entries()) if (joint) points[index + 1] = joint
  assert.equal(measurePlank(points, 0, 4/3).kind, 'holding')
})
