export function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  const charCount = normalized.length;
  const wordCount = normalized.split(/\s+/).length;
  const charBasedEstimate = Math.ceil(charCount / 4);
  const wordBasedEstimate = wordCount;
  return Math.max(charBasedEstimate, wordBasedEstimate);
}

export function exceedsTokenLimit(text: string, limit: number): boolean {
  return estimateTokenCount(text) > limit;
}
