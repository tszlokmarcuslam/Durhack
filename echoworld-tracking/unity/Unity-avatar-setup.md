# Use a Unity character in EchoWorld

The browser preview uses a built-in robot. To drive your own Unity character, add `EchoWorldAvatar.cs` to a Unity project with a rigged Humanoid model and build it for Web.

1. In Unity, select the model asset. In **Rig**, set **Animation Type** to **Humanoid** and apply it. Add the model to your scene and name its root GameObject `EchoWorldAvatar`.
2. Copy `EchoWorldAvatar.cs` into your Unity project's `Assets` folder. Attach it to the model's GameObject with the Humanoid `Animator`. Start with the model facing Unity's forward direction (+Z). Use an idle pose with no active animation controller while verifying tracking.
3. For facial animation, assign the face's `SkinnedMeshRenderer` to **Face Mesh**. The receiver uses blendshapes named `eyeBlinkLeft`, `eyeBlinkRight`, `jawOpen`, `mouthSmileLeft`, and `mouthSmileRight`. You can update `shapeNames` in the script if your model uses different names.
4. Build for **Web** and mount that build on the EchoWorld page. In the code where `createUnityInstance(...)` resolves, connect the instance to the tracking event. The listener needs to run in the same page as the React app and should be disposed when the Unity instance unmounts.

```js
function connectEchoWorldAvatar(unityInstance) {
  function onTracking(event) {
    const frame = event.detail;
    const payload = frame
      ? JSON.stringify({ pose: frame.pose, expressions: frame.expressions })
      : '';

    unityInstance.SendMessage('EchoWorldAvatar', 'ApplyTracking', payload);
  }

  window.addEventListener('echoworld:avatar-frame', onTracking);
  return () => window.removeEventListener('echoworld:avatar-frame', onTracking);
}
```

Once the scene and camera are running, raise each arm, bend an elbow, blink, and open your mouth. The receiver targets limb directions and matched facial blendshapes. Check the model's orientation and rest pose before tuning the motion for a specific rig. This receiver still needs to be tested with your Unity project.

[Unity documentation for calling C# from browser JavaScript](https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/webgl/develop/interactingwithbrowserscripting/web-interacting-browser-unity-to-js)
