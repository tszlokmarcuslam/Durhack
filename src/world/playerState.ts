import { Vector3 } from 'three';

/** Per-frame local player transform. Mutated in useFrame, read by the pet (and later, network sync). */
export const playerState = { position: new Vector3(), heading: 0 };

export const WORLD_HALF_SIZE = 18;
