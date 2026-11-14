import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_VOICE_ID } from '../types/voices';

interface PetState {
  bodyColor: string;
  glowColor: string;
  voiceEnabled: boolean;
  voiceId: string;
  set: (patch: Partial<Pick<PetState, 'bodyColor' | 'glowColor' | 'voiceEnabled' | 'voiceId'>>) => void;
}

/** The player's robot look, saved in localStorage so it survives reloads. */
export const usePetStore = create<PetState>()(
  persist(
    (set) => ({
      bodyColor: '#f1f5f9',
      glowColor: '#5eead4',
      voiceEnabled: true,
      voiceId: DEFAULT_VOICE_ID,
      set: (patch) => set(patch),
    }),
    { name: 'echoworld-pet' },
  ),
);
