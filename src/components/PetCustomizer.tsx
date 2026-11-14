import { useState } from 'react';
import { EXPRESSIONS, usePetStore } from '../store/petStore';
import { useCompanionStore } from '../store/companionStore';

const BODY_COLORS = ['#f1f5f9', '#fde68a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#334155'];
const GLOW_COLORS = ['#5eead4', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#4ade80'];
const FACES: Record<(typeof EXPRESSIONS)[number], string> = {
  happy: '◠‿◠',
  neutral: '•_•',
  surprised: 'O_O',
  sleepy: '-_-',
  wink: '◠‿-',
  love: '♥‿♥',
};

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 font-semibold">{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            aria-pressed={value === c}
            onClick={() => onPick(c)}
            className={`h-6 w-6 rounded-full border-2 ${value === c ? 'border-indigo-400' : 'border-white/20'}`}
            style={{ background: c }}
          />
        ))}
        <input
          type="color"
          aria-label={`Custom ${label.toLowerCase()}`}
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded bg-transparent"
        />
      </div>
    </fieldset>
  );
}

export function PetCustomizer() {
  const [open, setOpen] = useState(false);
  const pet = usePetStore();
  const voiceError = useCompanionStore((s) => s.voiceError);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-900"
      >
        🎨 Customise Echo
      </button>
      {open && (
        <div className="flex w-64 flex-col gap-3 rounded-xl bg-slate-900/90 p-3 text-xs text-slate-100">
          <Swatches label="Body colour" colors={BODY_COLORS} value={pet.bodyColor} onPick={(bodyColor) => pet.set({ bodyColor })} />
          <Swatches label="Glow colour" colors={GLOW_COLORS} value={pet.glowColor} onPick={(glowColor) => pet.set({ glowColor })} />
          <fieldset>
            <legend className="mb-1 font-semibold">Expression</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {EXPRESSIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={pet.expression === e}
                  onClick={() => pet.set({ expression: e })}
                  className={`rounded px-1 py-1 capitalize ${pet.expression === e ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  <span className="block font-mono">{FACES[e]}</span>
                  {e}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={pet.voiceEnabled} onChange={(e) => pet.set({ voiceEnabled: e.target.checked })} />
            Speak replies aloud (ElevenLabs)
          </label>
          {pet.voiceEnabled && voiceError && <p role="status" className="text-amber-300">{voiceError}</p>}
        </div>
      )}
    </div>
  );
}
