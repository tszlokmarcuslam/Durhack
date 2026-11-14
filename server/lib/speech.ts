// Replies show maths in symbols (a² + b² = c²); this turns them into words for the voice.
const WORDS: [RegExp, string][] = [
  [/²/g, ' squared'],
  [/³/g, ' cubed'],
  [/√/g, ' the square root of '],
  [/±/g, ' plus or minus '],
  [/[×*]/g, ' times '],
  [/÷/g, ' divided by '],
  [/≠/g, ' does not equal '],
  [/≤/g, ' is less than or equal to '],
  [/≥/g, ' is greater than or equal to '],
  [/≈/g, ' is approximately '],
  [/=/g, ' equals '],
  [/π/g, ' pi '],
  [/∞/g, ' infinity '],
  [/∫/g, ' the integral of '],
  [/Σ/g, ' the sum of '],
  [/Δ/g, ' delta '],
  [/θ/g, ' theta '],
  [/→/g, ' tends to '],
  [/½/g, ' one half'],
  [/¼/g, ' one quarter'],
  [/¾/g, ' three quarters'],
  [/°/g, ' degrees'],
  [/\^/g, ' to the power of '],
  [/−/g, ' minus '], // Unicode minus sign
  [/\s-\s/g, ' minus '], // spaced ASCII hyphen, not hyphenated words
  [/\s\+\s|\+/g, ' plus '],
  [/([\w)])\s*\/\s*([\w(])/g, '$1 over $2'],
  [/(\d)\s*</g, '$1 is less than '],
  [/(\d)\s*>/g, '$1 is greater than '],
];

export function toSpeech(text: string): string {
  let out = text;
  for (const [pattern, words] of WORDS) out = out.replace(pattern, words);
  return out.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}
