import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Point } from './exercise'
import { AvatarRig } from './avatarRig'
import { outfits, renderTrainer } from './trainer3d'
import './Avatar.css'

export type AvatarFrame = { pose: Point[]; face: Point[]; expressions: Record<string, number>; time: number }
type Color = keyof typeof outfits

function blend(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

export default function Avatar({ tracking }: { tracking: RefObject<AvatarFrame | null> }) {
  const surface = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState<Color>('Scarlet')
  const [view, setView] = useState('angle')
  const display = useRef({ color: 'Scarlet' as Color, view: 'angle' })

  useEffect(() => {
    const canvas = surface.current!
    const context = canvas.getContext('2d')
    if (!context) return
    const rig = new AvatarRig()
    let cameraYaw = Math.PI / 7
    const face = { tilt: 0, turn: 0, left: 0, right: 0, mouth: 0, smile: 0 }
    let previous = performance.now()
    let raf = 0
    function draw(now: number) {
      raf = requestAnimationFrame(draw)
      if (now - previous < 24) return
      const dt = Math.min(100, now - previous)
      previous = now
      const amount = 1 - Math.exp(-dt / 90)
      const frame = tracking.current
      const live = frame && now - frame.time < 650 ? frame : null
      const pose = rig.update(live?.pose ?? [], dt)

      const leftEye = live?.face[33], rightEye = live?.face[263], nose = live?.face[1]
      const scores = live?.expressions ?? {}
      const eyeWidth = leftEye && rightEye ? Math.max(.01, Math.abs(rightEye.x - leftEye.x)) : 1
      const targetFace = {
        tilt: leftEye && rightEye ? Math.atan2(leftEye.y - rightEye.y, eyeWidth) : 0,
        turn: leftEye && rightEye && nose ? Math.max(-1, Math.min(1, ((leftEye.x + rightEye.x) / 2 - nose.x) / eyeWidth * 4)) : 0,
        left: scores.eyeBlinkLeft ?? 0, right: scores.eyeBlinkRight ?? 0,
        mouth: scores.jawOpen ?? 0, smile: ((scores.mouthSmileLeft ?? 0) + (scores.mouthSmileRight ?? 0)) / 2,
      }
      for (const key of Object.keys(face) as (keyof typeof face)[]) face[key] = blend(face[key], targetFace[key], amount)

      const options = display.current
      const yaw = options.view === 'side' ? Math.PI / 2 : options.view === 'angle' ? Math.PI / 5 : 0
      cameraYaw = blend(cameraYaw, yaw, 1 - Math.exp(-dt / 125))
      renderTrainer(context!, pose, face, outfits[options.color], cameraYaw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [tracking])

  return (
    <section className="avatar-panel" aria-label="Avatar preview">
      <div className="avatar-toolbar">
        <h2>Avatar preview</h2>
        <label>Color<select value={color} onChange={event => {
          const next = event.target.value as Color
          display.current.color = next
          setColor(next)
        }}>
          {Object.keys(outfits).map(name => <option key={name}>{name}</option>)}
        </select></label>
        <label>View<select value={view} onChange={event => {
          display.current.view = event.target.value
          setView(event.target.value)
        }}>
          <option value="front">Front</option><option value="angle">Angled</option><option value="side">Side</option>
        </select></label>
      </div>
      <canvas className="avatar-canvas" ref={surface} width={480} height={340} aria-label="Trainer avatar that follows your movement" />
      <p className="note">Enable the camera and move your arms or legs. Include face tracking to animate the eyes and mouth.</p>
    </section>
  )
}
