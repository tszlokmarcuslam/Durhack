import { create } from 'zustand';
import { CompanionApiError, sendCompanionMessage, type CompanionErrorKind } from '../services/companionApi';
import { speak, stopSpeaking } from '../services/voice';
import type { ChatTurn, PublicPlayer } from '../types/companion';
import { usePetStore } from './petStore';

export interface ChatMessage extends ChatTurn {
  id: number;
  players?: PublicPlayer[];
  devMode?: boolean;
}

interface CompanionState {
  messages: ChatMessage[];
  status: 'idle' | 'thinking';
  error: { kind: CompanionErrorKind; message: string } | null;
  /** Text of the message that failed, kept so the user can retry it. */
  failedText: string | null;
  chatOpen: boolean;
  speaking: boolean;
  /** Last voice problem (missing key, quota, blocked autoplay). Chat still works without voice. */
  voiceError: string | null;
  setChatOpen: (open: boolean) => void;
  send: (text: string) => Promise<void>;
  retry: () => Promise<void>;
}

const HISTORY_TURNS = 10; // server accepts 12
let nextId = 1;

export const useCompanionStore = create<CompanionState>((set, get) => ({
  messages: [],
  status: 'idle',
  error: null,
  failedText: null,
  chatOpen: false,
  speaking: false,
  voiceError: null,
  setChatOpen: (chatOpen) => set({ chatOpen }),

  async send(text) {
    const message = text.trim();
    if (!message || get().status === 'thinking') return;
    const history = get().messages.slice(-HISTORY_TURNS).map(({ role, text }) => ({ role, text }));
    stopSpeaking();
    set((s) => ({
      messages: [...s.messages, { id: nextId++, role: 'user', text: message }],
      status: 'thinking',
      error: null,
      failedText: null,
    }));
    try {
      const res = await sendCompanionMessage({ message, history });
      set((s) => ({
        status: 'idle',
        messages: [
          ...s.messages,
          { id: nextId++, role: 'assistant', text: res.reply, players: res.players, devMode: res.mode === 'dev' },
        ],
      }));
      if (res.mode === 'live' && usePetStore.getState().voiceEnabled) {
        speak(res.reply, () => set({ speaking: true, voiceError: null }))
          .catch((err: Error) => set({ voiceError: err.message }))
          .finally(() => set({ speaking: false }));
      }
    } catch (err) {
      const error =
        err instanceof CompanionApiError
          ? { kind: err.kind, message: err.message }
          : { kind: 'server' as const, message: 'Something went wrong.' };
      // Drop the unsent user message so history stays a valid user/assistant alternation.
      set((s) => ({ status: 'idle', error, failedText: message, messages: s.messages.slice(0, -1) }));
    }
  },

  async retry() {
    const text = get().failedText;
    if (text) await get().send(text);
  },
}));
