import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const EXPRESSIONS = ['happy', 'neutral', 'surprised', 'sleepy', 'wink', 'love'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

interface PetState {
  bodyColor: string;
  glowColor: string;
  expression: Expression;
  voiceEnabled: boolean;
  set: (patch: Partial<Pick<PetState, 'bodyColor' | 'glowColor' | 'expression' | 'voiceEnabled'>>) => void;
}

/** The player's robot look, saved in localStorage so it survives reloads. */
export const usePetStore = create<PetState>()(
  persist(
    (set) => ({
      bodyColor: '#f1f5f9',
      glowColor: '#5eead4',
      expression: 'happy',
      voiceEnabled: true,
      set: (patch) => set(patch),
    }),
    { name: 'echoworld-pet' },
  ),
);
