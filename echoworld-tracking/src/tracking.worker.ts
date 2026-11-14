import { FaceLandmarker, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

// MediaPipe calls this hook when importScripts is unavailable in a module
// worker. Keep its public runtime URL out of Vite's source import transforms.
const runtime = self as typeof self & { import: (url: string) => Promise<void> }
runtime.import = async (url: string) => {
  // Absolute URLs also prevent Vite's runtime helper appending ?import.
  const assetUrl = new URL(url, self.location.href).href
  await import(/* @vite-ignore */ assetUrl)
}

let pose: PoseLandmarker
let face: FaceLandmarker | undefined
let frames = 0
self.onmessage = async (event: MessageEvent) => {
  const message = event.data
  try {
    if (message.type === 'init') {
      const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm', true)
      pose = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task' },
        runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .6, minTrackingConfidence: .6, outputSegmentationMasks: false,
      })
      if (message.face) {
        // The task loader clears ModuleFactory after each model. A distinct
        // module URL reinitializes that factory for the second model.
        face = await FaceLandmarker.createFromOptions({ ...files, wasmLoaderPath: `${files.wasmLoaderPath}?face` }, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
          runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
        })
      }
      self.postMessage({ type: 'ready', connections: PoseLandmarker.POSE_CONNECTIONS })
    } else if (message.type === 'frame') {
      try {
        const result = pose.detectForVideo(message.bitmap, message.time)
        const facial = face && frames++ % 2 === 0 ? face.detectForVideo(message.bitmap, message.time) : undefined
        self.postMessage({ type: 'result', time: message.time, points: result.landmarks[0] ?? [], world: result.worldLandmarks[0] ?? [], facial })
        result.close()
      } finally { message.bitmap.close() }
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
