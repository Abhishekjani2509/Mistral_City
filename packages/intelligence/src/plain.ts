const TECHNICAL_MARKERS = [
  /[`]/,
  /\b[\w/-]+\.(?:ts|tsx|js|jsx|sql|json|yaml|yml)\b/i,
  /\b[A-Z]{2,}\b/,
  /\b\w+\(\)/,
  /\b(?:function|class|component|variable|database query|endpoint|middleware)\b/i,
];

export function ensurePlainEnglish(candidate: string, fallback: string): string {
  const sentence = candidate.trim().replace(/\s+/g, " ");
  if (!sentence || TECHNICAL_MARKERS.some((marker) => marker.test(sentence))) return fallback;
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}
