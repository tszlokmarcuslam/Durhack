import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RepCounter, angle, measure } from './exercise.ts'
const sample = (phase, { anchor, rise, valid = true } = {}) => ({
  valid, angle: 120, extended: phase === 'extended', contracted: phase === 'contracted', hint: '',
  motion: { side: 0, height: rise ?? (phase === 'contracted' ? .15 : .3), length: .3, anchor },
})
function hold(counter, phase, time, extra) {
  for (let offset = 0; offset <= 240; offset += 80) counter.update(sample(phase, extra), time+offset)
}
test('counts one completed cycle, not repeated endpoints or partial motions', () => {
  const c = new RepCounter()
  hold(c,'contracted',0); hold(c,'extended',320)
  assert.equal(c.count,0)
  hold(c,'contracted',640); hold(c,'extended',1120)
  assert.equal(c.count,1)
  hold(c,'extended',1440)
  assert.equal(c.count,1)
})
test('rejects rapid false cycles and sustained visibility loss', () => {
  const c = new RepCounter()
  hold(c,'extended',0)
  c.update(sample('contracted'),320); c.update(sample('extended'),400)
  assert.equal(c.count,0)
  c.resetPartial()
  hold(c,'extended',800)
  hold(c,'contracted',1120)
  c.update(sample('neutral',{valid:false}),1780)
  hold(c,'extended',1840)
  assert.equal(c.count,0)
})
test('does not bridge a tracking gap', () => {
  const c = new RepCounter()
  hold(c,'extended',0); hold(c,'contracted',400); hold(c,'extended',3000)
  assert.equal(c.count,0)
})
test('pull-ups need rising shoulders and fixed hands', () => {
  const c = new RepCounter()
  const anchor = {x:.3,y:.2}
  hold(c,'extended',0,{anchor,rise:.3})
  hold(c,'contracted',400,{anchor,rise:.3})
  hold(c,'extended',800,{anchor,rise:.3})
  assert.equal(c.count,0)
  hold(c,'contracted',1120,{anchor,rise:.15})
  hold(c,'extended',1520,{anchor,rise:.3})
  assert.equal(c.count,1)
  hold(c,'contracted',1840,{anchor:{x:.5,y:.2},rise:.15})
  hold(c,'extended',2240,{anchor,rise:.3})
  assert.equal(c.count,1)
})
test('angles correct for image aspect and invalid points do not count', () => {
  assert.ok(Math.abs(angle({x:0,y:0},{x:1,y:0},{x:1,y:1},4/3)-90)<.001)
  assert.equal(measure([], 'pushup', 0, 4/3).valid,false)
  const points = Array.from({length:33},()=>({x:.5,y:.5,visibility:.1}))
  assert.equal(measure(points,'pullup',0,4/3).valid,false)
})

// Only the right arm and hip are in view. Coordinates approximate a side-on push-up.
function pushupPose(position) {
  const points = []
  const joint = (index, x, y) => { points[index] = { x, y, visibility: .85 } }
  const shoulder = { top: .30, midway: .39, bottom: .49, armsOnly: .30 }[position]
  joint(12, .60, shoulder)
  joint(14, position === 'bottom' ? .50 : position === 'armsOnly' ? .42 : .60, position === 'top' ? .45 : .48)
  joint(16, .60, .60)
  joint(24, .29, shoulder + .07)
  return points
}

function feedPushups(counter, frames) {
  for (const [position, time] of frames) {
    const pose = position ? pushupPose(position) : []
    counter.update(measure(pose, 'pushup', 0, 4/3, counter.trackedSide), time)
  }
}

test('counts continuous push-ups through a single missing frame, with only the opposite upper body visible', () => {
  const counter = new RepCounter()
  feedPushups(counter, [['top', 0], ['midway', 160], ['bottom', 320], [null, 400], ['midway', 480], ['top', 640]])
  assert.equal(counter.count, 1)
  assert.equal(counter.trackedSide, 1)
  feedPushups(counter, [['midway', 800], ['bottom', 960], ['midway', 1120], ['top', 1280], ['top', 1360]])
  assert.equal(counter.count, 2)
})

test('push-ups reject an elbow bend without a shoulder drop and an interrupted rep', () => {
  const counter = new RepCounter()
  feedPushups(counter, [['top', 0], ['armsOnly', 320], ['top', 640]])
  assert.equal(counter.count, 0)
  feedPushups(counter, [['bottom', 960], [null, 1640], ['top', 1800]])
  assert.equal(counter.count, 0)
})

function limbPose(indices, coords) {
  const points = []
  for (const [i, [x, y]] of coords.entries()) points[indices[i]] = { x, y, visibility: .6 }
  return points
}

test('counts a continuous squat with only the far side leg visible and a dropped frame', () => {
  const counter = new RepCounter()
  const leg = (hip, knee) => limbPose([24, 26, 28], [hip, knee, [.50, .88]])
  const standing = leg([.49, .45], [.49, .67])
  const halfway = leg([.44, .54], [.54, .68])
  const lowered = leg([.36, .67], [.57, .69])
  for (const [points, time] of [[standing, 0], [halfway, 160], [lowered, 320], [[], 400], [halfway, 480], [standing, 640]]) {
    counter.update(measure(points, 'squat', 0, 4/3, counter.trackedSide), time)
  }
  assert.equal(counter.count, 1)
})

test('counts a continuous pull-up with one arm visible and the shoulder rising toward a fixed wrist', () => {
  const counter = new RepCounter()
  const arm = (shoulder, elbow) => limbPose([12, 14, 16], [shoulder, elbow, [.50, .22]])
  const hang = arm([.52, .53], [.51, .38])
  const halfway = arm([.55, .42], [.57, .36])
  const lifted = arm([.57, .25], [.60, .38])
  for (const [points, time] of [[hang, 0], [halfway, 160], [lifted, 320], [[], 400], [halfway, 480], [hang, 640]]) {
    counter.update(measure(points, 'pullup', 0, 4/3, counter.trackedSide), time)
  }
  assert.equal(counter.count, 1)
})

test('counts a front-view squat from its height change even when its projected knee stays straight', () => {
  const counter = new RepCounter()
  for (const [height, time] of [[.40, 0], [.44, 180], [.55, 360], [.60, 540], [.52, 720], [.41, 900]]) {
    const points = limbPose([23, 25, 27], [[.5, height], [.5, .68], [.5, .9]])
    counter.update(measure(points, 'squat', 0, 4/3, counter.trackedSide), time)
  }
  assert.equal(counter.count, 1)
})

test('uses 3D elbow bend and counts a push-up with low-confidence hips and a brief arm dropout', () => {
  const counter = new RepCounter()
  for (const [shoulderY, elbowY, elbowZ, time] of [[.30, .45, 0, 0], [.34, .46, .08, 160], [.46, .51, .16, 320], [null, 0, 0, 560], [.37, .48, .06, 800], [.31, .46, .02, 960]]) {
    const indices = [11, 13, 15]
    const coords = [[.5, shoulderY], [.5, elbowY], [.5, .60]]
    const points = shoulderY === null ? [] : limbPose(indices, coords)
    const world = points.map((point, i) => ({ ...point, z: i === 13 ? elbowZ : 0 }))
    const detected = measure(points, 'pushup', 0, 4/3, counter.trackedSide, world)
    if (time === 320) assert.ok(detected.angle < 125)
    counter.update(detected, time)
  }
  assert.equal(counter.count, 1)
})
