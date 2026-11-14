import { create } from 'zustand';
import { CompanionApiError, sendCompanionMessage, type CompanionErrorKind } from '../services/companionApi';
import type { ChatTurn, PublicPlayer } from '../types/companion';

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

  async send(text) {
    const message = text.trim();
    if (!message || get().status === 'thinking') return;
    const history = get().messages.slice(-HISTORY_TURNS).map(({ role, text }) => ({ role, text }));
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
