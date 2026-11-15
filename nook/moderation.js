// Nook chat filter: blocks hateful language (slurs and hate phrases) before a message is sent or shown.
// Ordinary swearing is allowed; this only targets hate. It catches common dodges: l33t letters (n1gg3r),
// stretched letters (niiigger), spaced letters (n i g g e r) and plurals.
// Blocked words are stored ROT13-encoded so the source is safe to show on screen; they are decoded once on load.
// A client-side filter is a first line only: the server must run the same check before relaying a message.

const rot13 = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 84) % 26 + 97));

const SLURS = ["avttre", "avttn", "avttnu", "fnaqavttre", "puvax", "tbbx", "fcvp", "fcvpx", "jrgonpx", "ornare", "xvxr", "xlxr", "cnxv", "enturnq", "gbjryurnq", "pbba", "wvtnobb", "cbepuzbaxrl", "whatyrohaal", "tbyyvjbt", "jbt", "mvccreurnq", "fynagrlr", "puvanzna", "tlccb", "tlcb", "cvxrl", "snttbg", "qlxr", "genaal", "furznyr", "ergneq", "ergneqrq", "zbatbybvq"].map(rot13);
// The worst few are also matched with every space and symbol removed ("n.i.g g-e-r").
const SEVERE = ["avttre", "avttn", "snttbg"].map(rot13);

const LEET = { a: '[a4@]', b: '[b8]', e: '[e3]', g: '[g96]', i: '[i1!|l]', l: '[l1|]', o: '[o0]', s: '[s5$]', t: '[t7+]' };
const body = w => [...w].map(c => (LEET[c] || c) + '+').join('');
const WORD_RE = SLURS.map(w => new RegExp('^' + body(w) + '(?:[e3]?[s5$z])?$'));
const SQUASH_RE = SEVERE.map(w => new RegExp(body(w)));

const GROUPS = '(?:jews?|muslims?|blacks?|gays?|lesbians?|trans(?:gender)? people|immigrants?|refugees?|asians?|mexicans?|arabs?|africans?|chinese|indians?|women|whites?|christians?|hindus?|sikhs?)';
const PHRASES = [
  /\bk+y+s+\b/,
  /\bkill (?:your ?self|ur ?self|yourselves|urselves|yo ?self)\b/,
  /\b(?:go|get|fuck off) back to (?:your|ur|yr|where) (?:own )?(?:country|countries|you came from|u came from)\b/,
  /\bheil hitler\b/, /\bsieg heil\b/, /\bwhite power\b/, /\bgas the jews\b/, /\bhitler (?:was|did) (?:right|nothing wrong)\b/,
  new RegExp(`\\b${GROUPS} (?:should|must|need to|deserve to|ought to) (?:all )?(?:die|be killed|be shot|be gassed|burn|hang|be exterminated)\\b`),
  new RegExp(`\\bdeath to (?:all )?(?:the )?${GROUPS}\\b`),
  new RegExp(`\\bhate (?:all )?(?:the )?${GROUPS}$`)
];

const base = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[​-‍⁠﻿]/g, '').toLowerCase();

function tokens(s) {
  const raw = s.split(/[\s.,;:'"`()[\]{}<>\-_*~#^&/\\=?]+/).map(t => t.replace(/^[!¡]+|!+$/g, '')).filter(Boolean);
  const out = raw.slice();
  let run = '';
  for (const t of raw.concat('')) {
    if (t.length === 1) { run += t; continue; }
    if (run.length >= 3) out.push(run);
    run = '';
  }
  return out;
}

const LEET_PLAIN = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', '@': 'a', $: 's', 5: 's', 7: 't' };

/** Returns { ok: true } or { ok: false, reason: 'slur' | 'phrase' }. */
export function checkMessage(text) {
  const s = base(text);
  if (!s.trim()) return { ok: true };
  const toks = tokens(s);
  if (toks.some(t => WORD_RE.some(r => r.test(t)))) return { ok: false, reason: 'slur' };
  const squash = s.replace(/[^a-z0-9@$!|+]/g, '');
  if (SQUASH_RE.some(r => r.test(squash))) return { ok: false, reason: 'slur' };
  if (/\b14\s*88\b/.test(s)) return { ok: false, reason: 'phrase' };
  const plain = s.replace(/[0134@$57]/g, c => LEET_PLAIN[c]).replace(/[^a-z\s]/g, ' ').replace(/(.)\1{2,}/g, '$1$1').replace(/\s+/g, ' ').trim();
  if (PHRASES.some(r => r.test(plain))) return { ok: false, reason: 'phrase' };
  return { ok: true };
}
