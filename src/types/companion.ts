// Shared between browser and server. Keep this file free of runtime imports.

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
  /** 'live' = Gemini answered. 'dev' = local dev mode without credentials; no AI was called. */
  mode: 'live' | 'dev';
}

export interface ApiError {
  error: string;
  message: string;
}
