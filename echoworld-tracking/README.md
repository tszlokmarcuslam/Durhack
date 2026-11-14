# EchoWorld Tracking Lab

Run the motion tracking prototype from this folder with Node.js and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite, then select **Enable camera & tracking**. The MediaPipe models download on first use. Camera frames are processed in the browser. Try the push-up, squat, pull-up and plank modes, or follow your movement in the 3D avatar preview.

```sh
npm run build
npm run lint
node --test src/exercise.test.mjs src/plank.test.mjs
```

See [Unity setup](unity/Unity-avatar-setup.md) for the optional Unity Web receiver. This prototype also runs on its own with the built-in trainer.
