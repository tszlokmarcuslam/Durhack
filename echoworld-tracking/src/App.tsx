import { useEffect, useRef, useState } from 'react'
import { guides, measure, RepCounter, visible } from './exercise'
import type { Exercise, Point, RepExercise } from './exercise'
import { measurePlank, PlankTimer } from './plank'
import Avatar from './Avatar'
import type { AvatarFrame } from './Avatar'
import './App.css'

const modes: Record<Exercise, string> = { free: 'Free movement', pushup: 'Push-ups', pullup: 'Pull-ups', squat: 'Squats', plank: 'Plank' }
function isRepExercise(mode: Exercise): mode is RepExercise {
  return mode !== 'free' && mode !== 'plank'
}

function formatHold(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
const cues = {
  pushup: { ready: 'Start at the top with your arms extended.', extended: 'Lower your shoulders and bend your elbows.', contracted: 'Press back to the top to count the rep.' },
  pullup: { ready: 'Start with your arms extended overhead.', extended: 'Pull your shoulders up toward your hands.', contracted: 'Lower back to extended arms to count the rep.' },
  squat: { ready: 'Stand tall to start.', extended: 'Lower your hips and bend your knees.', contracted: 'Stand back up to count the rep.' },
}
export default function App() {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const session = useRef(0)
  const cleanup = useRef<() => void>(() => {})
  const avatarFrame = useRef<AvatarFrame | null>(null)
  const counter = useRef(new RepCounter())
  const plank = useRef(new PlankTimer())
  const settings = useRef({ mode: 'free' as Exercise, side: 0 })
  const [mode, setMode] = useState<Exercise>('free')
  const [side, setSide] = useState(0)
  const [includeFace, setIncludeFace] = useState(true)
  const [status, setStatus] = useState('Ready to start')
  const [active, setActive] = useState(false)
  const [metrics, setMetrics] = useState<Record<string, number>>({})
  const [repDepth, setRepDepth] = useState<number | null>(null)
  const [peakDepth, setPeakDepth] = useState<number | null>(null)
  const [hold, setHold] = useState(() => ({ elapsedMs: 0, resets: 0, notice: '', cue: 'Get into a plank to start the timer.' }))
  const [body, setBody] = useState({ count: 0, phase: 'ready', angle: 0, hint: 'Enable tracking to begin', visible: 0 })
  useEffect(() => () => { session.current++; cleanup.current() }, [])
  function showPlank() {
    const { elapsedMs, resets, notice, cue } = plank.current
    setHold({ elapsedMs, resets, notice, cue })
  }
  function resetPlank() {
    plank.current = new PlankTimer()
    showPlank()
  }
  function reset() {
    counter.current = new RepCounter()
    resetPlank()
    setRepDepth(null)
    setPeakDepth(null)
    setBody({ count: 0, phase: 'ready', angle: 0, hint: 'Start in the extended position', visible: 0 })
  }
  function stop() {
    resetPlank()
    setRepDepth(null)
    session.current++; cleanup.current(); counter.current.resetPartial()
    setActive(false); setMetrics({}); setStatus('Camera stopped')
    setBody(old => ({ ...old, phase: 'ready', angle: 0, visible: 0, hint: 'Camera stopped' }))
  }
  async function start() {
    const id = ++session.current
    let stream: MediaStream | undefined
    let worker: Worker | undefined
    let frame = 0, lastFrame = -1, lastRun = 0
    let busy = false
    let connections: { start: number; end: number }[] = []
    const release = () => {
      avatarFrame.current = null
      window.dispatchEvent(new CustomEvent('echoworld:avatar-frame', { detail: null }))
      cancelAnimationFrame(frame); worker?.terminate()
      stream?.getTracks().forEach(track => track.stop())
      if (video.current) video.current.srcObject = null
      const overlay = canvas.current
      overlay?.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height)
    }
    cleanup.current = release
    function fail(message: string) {
      if (id !== session.current) return
      resetPlank()
      session.current++; release(); counter.current.resetPartial()
      setActive(false); setMetrics({})
      setRepDepth(null)
      setBody(old => ({ ...old, phase: 'ready', angle: 0, visible: 0, hint: 'Tracking interrupted' }))
      setStatus(`Tracking stopped: ${message}. Check camera permission and internet access, then retry.`)
    }
    setActive(true); setStatus('Waiting for camera permission...')
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false })
      if (id !== session.current) { stream.getTracks().forEach(track => track.stop()); return }
      stream.getVideoTracks()[0].onended = () => fail('Camera disconnected')
      const element = video.current!
      element.srcObject = stream
      await element.play()
      if (id !== session.current) return
      setStatus('Loading body' + (includeFace ? ' and face' : '') + ' models...')
      worker = new Worker(new URL('./tracking.worker.ts', import.meta.url), { type: 'module' })
      worker.onerror = event => fail(event.message || 'Tracking worker failed')
      worker.onmessage = event => {
        if (id !== session.current) return
        const data = event.data
        if (data.type === 'error') { fail(data.message); return }
        if (data.type === 'ready') {
          connections = data.connections; setStatus('Tracking active - move into view')
          frame = requestAnimationFrame(tick)
        }
        if (data.type !== 'result') return
        busy = false
        if (performance.now()-data.time > 1000) { counter.current.resetPartial(); return }
        const points = data.points as Point[]
        const expressions: Record<string, number> = {}
        for (const category of data.facial?.faceBlendshapes[0]?.categories ?? []) {
          expressions[category.categoryName] = category.score
        }
        const previous = avatarFrame.current
        const face = data.facial ? data.facial.faceLandmarks[0] ?? [] : previous?.face ?? []
        const motion: AvatarFrame = {
          pose: data.world ?? [], face,
          expressions: data.facial ? expressions : previous?.expressions ?? {}, time: data.time,
        }
        avatarFrame.current = motion
        window.dispatchEvent(new CustomEvent('echoworld:avatar-frame', { detail: motion }))
        const { mode, side } = settings.current
        const aspect = element.videoWidth / element.videoHeight
        const visibleJoints = points.filter(point => visible(point))
        if (mode === 'plank') {
          plank.current.update(measurePlank(points, side, aspect), data.time)
          showPlank()
          setBody(old => ({ ...old, visible: visibleJoints.length }))
        } else {
          const reps = counter.current
          const sample = measure(points, mode, side, aspect, reps.trackedSide, data.world)
          const depthBeforeUpdate = reps.depth(sample)
          reps.update(sample, data.time)
          setRepDepth(reps.depth(sample))
          if (depthBeforeUpdate !== null) setPeakDepth(peak => Math.max(peak ?? 0, depthBeforeUpdate))
          const hint = isRepExercise(mode) && sample.valid ? `${sample.hint} ${cues[mode][reps.phase]}` : sample.hint
          setBody({ count: reps.count, phase: reps.phase, angle: sample.valid ? sample.angle : 0, hint, visible: visibleJoints.length })
        }
        setStatus(points.length ? 'Body tracking active' : 'No body detected - step back into view')
        const overlay = canvas.current!
        overlay.width = element.videoWidth; overlay.height = element.videoHeight
        const ctx = overlay.getContext('2d')!
        ctx.lineWidth = 3; ctx.strokeStyle = '#63ffd1'; ctx.fillStyle = '#63ffd1'
        for (const edge of connections) {
          const a = points[edge.start], b = points[edge.end]
          if (!visible(a) || !visible(b)) continue
          ctx.beginPath(); ctx.moveTo(a.x*overlay.width,a.y*overlay.height); ctx.lineTo(b.x*overlay.width,b.y*overlay.height); ctx.stroke()
        }
        for (const point of visibleJoints) {
          ctx.beginPath(); ctx.arc(point.x*overlay.width,point.y*overlay.height,4,0,Math.PI*2); ctx.fill()
        }
        if (data.facial) {
          setMetrics(expressions); ctx.fillStyle = '#b7a0ff'
          for (const point of data.facial.faceLandmarks[0] ?? []) {
            ctx.beginPath(); ctx.arc(point.x*overlay.width,point.y*overlay.height,1,0,Math.PI*2); ctx.fill()
          }
        }
      }
      async function tick(now: number) {
        if (id !== session.current) return
        frame = requestAnimationFrame(tick)
        if (settings.current.mode === 'plank' && plank.current.checkTracking(now)) showPlank()
        if (busy || document.hidden || element.readyState < 2 || element.currentTime === lastFrame || now-lastRun < 80) return
        busy = true; lastFrame = element.currentTime; lastRun = now
        try {
          const bitmap = await createImageBitmap(element)
          if (id !== session.current) { bitmap.close(); return }
          worker!.postMessage({ type: 'frame', bitmap, time: now }, [bitmap])
        } catch (error) { fail(error instanceof Error ? error.message : String(error)) }
      }
      worker.postMessage({ type: 'init', face: includeFace })
    } catch (error) { fail(error instanceof Error ? error.message : String(error)) }
  }
  return (
    <main>
      <span className="eyebrow">ECHOWORLD / MOTION LAB</span>
      <h1>Move beyond the screen.</h1>
      <p>Full-body tracking, facial expressions, and exercise timers and counters.</p>
      <div className="settings">
        <label>Activity<select value={mode} onChange={e => { const next = e.target.value as Exercise; settings.current.mode = next; setMode(next); reset() }}>{Object.entries(modes).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Side facing camera<select value={side} onChange={e => { const next = Number(e.target.value); settings.current.side = next; setSide(next); reset() }}><option value={0}>My left side</option><option value={1}>My right side</option></select></label>
        <label className="checkbox"><input type="checkbox" checked={includeFace} disabled={active} onChange={e => setIncludeFace(e.target.checked)} /> Include face tracking</label>
      </div>
      <p className="guidance">{guides[mode]}</p>
      <div className="controls"><button disabled={active} onClick={() => void start()}>Enable camera & tracking</button><button disabled={!active} onClick={stop}>Stop camera</button>{mode !== 'free' && <button onClick={reset}>{mode === 'plank' ? 'Reset timer' : 'Reset repetitions'}</button>}</div>
      <p className="status" role="status">{status}</p>
      <div className="preview"><video ref={video} autoPlay playsInline muted /><canvas ref={canvas} aria-label="Body skeleton and face landmarks" /></div>
      <Avatar tracking={avatarFrame} />
      <section className="stats" aria-label="Motion measurements">
        {mode === 'plank' && <div><strong role="timer">{formatHold(hold.elapsedMs)}</strong><span>Plank hold</span></div>}
        {isRepExercise(mode) && <>
          <div><strong>{body.count}</strong><span>Completed reps</span></div>
          <div><strong>{body.angle ? `${Math.round(body.angle)}°` : '-'}</strong><span>{mode === 'squat' ? 'Knee angle' : 'Elbow angle'}</span></div>
        </>}
        <div><strong>{body.visible}/33</strong><span>Visible body landmarks</span></div>
        {(mode === 'pushup' || mode === 'squat') && <div><strong>{repDepth === null ? '-' : `${Math.round(repDepth * 100)}%`}</strong><span>{mode === 'squat' ? 'Hip drop (% of leg length)' : 'Shoulder drop (% of arm length)'}</span></div>}
      </section>
      {mode === 'plank' ? <>
        <p>{hold.cue}</p>
        <div role="status">{hold.notice && <p className="guidance" key={hold.resets}>{hold.notice}</p>}</div>
      </> : <p>{body.hint}{isRepExercise(mode) && ` | Phase: ${body.phase}`}</p>}
      {(mode === 'pushup' || mode === 'squat') && peakDepth !== null && <p className="note">Largest drop since reset: {Math.round(peakDepth * 100)}%.</p>}
      {mode === 'pushup' && <p className="note">Lower your shoulders relative to your hands, then return to the height where you started. Counts depend on the camera angle.</p>}
      {(mode === 'pullup' || mode === 'squat') && <p className="note">Move smoothly from the starting position and return to it to count the rep. Counts depend on the camera angle.</p>}
      {includeFace && <section className="metrics" aria-label="Facial expression scores">{Object.entries({ eyeBlinkLeft: 'Left blink', eyeBlinkRight: 'Right blink', jawOpen: 'Mouth open', mouthSmileLeft: 'Left smile', mouthSmileRight: 'Right smile' }).map(([key,label]) => <label key={key}>{label}<progress max="1" value={metrics[key] ?? 0} /><span>{Math.round((metrics[key] ?? 0)*100)}%</span></label>)}</section>}
      <p className="note">Camera frames stay in your browser. Models download on startup.</p>
    </main>
  )
}
