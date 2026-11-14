using System;
using UnityEngine;

// Attach to the same GameObject as a Humanoid Animator in a Unity Web build.
[RequireComponent(typeof(Animator))]
public sealed class EchoWorldAvatar : MonoBehaviour
{
    [Serializable] private class Joint { public float x, y, z, visibility; }
    [Serializable] private class Face { public float eyeBlinkLeft, eyeBlinkRight, jawOpen, mouthSmileLeft, mouthSmileRight; }
    [Serializable] private class Frame { public Joint[] pose; public Face expressions; }

    [SerializeField] private SkinnedMeshRenderer faceMesh;
    private Frame frame;
    private float lastFrame;
    private Transform rig;
    private readonly HumanBodyBones[] starts = {
        HumanBodyBones.LeftUpperArm, HumanBodyBones.LeftLowerArm,
        HumanBodyBones.RightUpperArm, HumanBodyBones.RightLowerArm,
        HumanBodyBones.LeftUpperLeg, HumanBodyBones.LeftLowerLeg,
        HumanBodyBones.RightUpperLeg, HumanBodyBones.RightLowerLeg
    };
    private readonly HumanBodyBones[] ends = {
        HumanBodyBones.LeftLowerArm, HumanBodyBones.LeftHand,
        HumanBodyBones.RightLowerArm, HumanBodyBones.RightHand,
        HumanBodyBones.LeftLowerLeg, HumanBodyBones.LeftFoot,
        HumanBodyBones.RightLowerLeg, HumanBodyBones.RightFoot
    };
    private readonly int[] startPoints = { 11, 13, 12, 14, 23, 25, 24, 26 };
    private readonly int[] endPoints = { 13, 15, 14, 16, 25, 27, 26, 28 };
    private readonly Transform[] bones = new Transform[8];
    private readonly Vector3[] localDirections = new Vector3[8];
    private readonly Quaternion[] restRotations = new Quaternion[8];
    private readonly string[] shapeNames = { "eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmileLeft", "mouthSmileRight" };
    private readonly int[] shapeIndices = new int[5];

    private void Start()
    {
        var animator = GetComponent<Animator>();
        if (!animator.isHuman) { enabled = false; return; }
        rig = animator.transform;
        for (int i = 0; i < bones.Length; i++)
        {
            Transform bone = animator.GetBoneTransform(starts[i]);
            Transform tip = animator.GetBoneTransform(ends[i]);
            if (bone == null || tip == null) continue;
            bones[i] = bone;
            restRotations[i] = bone.localRotation;
            localDirections[i] = bone.InverseTransformDirection(tip.position - bone.position).normalized;
        }
        for (int i = 0; i < shapeNames.Length; i++)
            shapeIndices[i] = faceMesh != null && faceMesh.sharedMesh != null ? faceMesh.sharedMesh.GetBlendShapeIndex(shapeNames[i]) : -1;
    }

    public void ApplyTracking(string json)
    {
        frame = string.IsNullOrEmpty(json) ? null : JsonUtility.FromJson<Frame>(json);
        lastFrame = Time.unscaledTime;
    }

    private void LateUpdate()
    {
        if (rig == null) return;
        bool live = frame != null && Time.unscaledTime - lastFrame < .65f;
        float smoothing = 1f - Mathf.Exp(-Time.unscaledDeltaTime * 12f);
        for (int i = 0; i < bones.Length; i++)
        {
            Transform bone = bones[i];
            if (bone == null) continue;
            if (!live || frame.pose == null || frame.pose.Length <= endPoints[i])
            {
                bone.localRotation = Quaternion.Slerp(bone.localRotation, restRotations[i], smoothing);
                continue;
            }
            Joint from = frame.pose[startPoints[i]], to = frame.pose[endPoints[i]];
            if (from == null || to == null || Mathf.Min(from.visibility, to.visibility) < .45f) continue;
            var direction = rig.TransformDirection(new Vector3(from.x - to.x, from.y - to.y, from.z - to.z));
            if (direction.sqrMagnitude < .00001f) continue;
            Quaternion target = Quaternion.FromToRotation(bone.TransformDirection(localDirections[i]), direction) * bone.rotation;
            bone.rotation = Quaternion.Slerp(bone.rotation, target, smoothing);
        }
        Face face = live ? frame.expressions : null;
        if (faceMesh == null) return;
        SetShape(0, face?.eyeBlinkLeft ?? 0);
        SetShape(1, face?.eyeBlinkRight ?? 0);
        SetShape(2, face?.jawOpen ?? 0);
        SetShape(3, face?.mouthSmileLeft ?? 0);
        SetShape(4, face?.mouthSmileRight ?? 0);
    }

    private void SetShape(int slot, float value)
    {
        if (shapeIndices[slot] >= 0) faceMesh.SetBlendShapeWeight(shapeIndices[slot], Mathf.Clamp01(value) * 100f);
    }
}
