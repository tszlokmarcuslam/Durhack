// Shared between browser and server. Keep this file free of runtime imports.

/** Faces the companion can make. The model picks one per reply; the server validates it. */
export const EXPRESSIONS = ['happy', 'neutral', 'surprised', 'sad', 'wink', 'love'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** A player as returned by discovery. Only fields the player opted to share are present. */
export interface PublicPlayer {
  id: string;
  username: string;
  displayName: string;
  city?: string;
  university?: string;
  subject?: string;
  interests?: string[];
  bio?: string;
}

export interface CompanionRequest {
  message: string;
  history: ChatTurn[];
}

export interface CompanionResponse {
  reply: string;
  /** Rows returned by the database this turn. Never model-generated. */
  players: PublicPlayer[];
  /** Face to show while saying this reply. */
  expression: Expression;
  /** Up to 3 short lines (equations, symbols) to write on the whiteboard; usually empty. */
  board: string[];
  /** 'live' = Gemini answered. 'dev' = local dev mode without credentials; no AI was called. */
  mode: 'live' | 'dev';
}

export interface ApiError {
  error: string;
  message: string;
}
