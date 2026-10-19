// Heuristic spam flag. The indexers do not expose a reliable "spam" bit for every chain; airdropped scam NFTs mostly advertise
// a URL, a claim or a reward in their name/symbol. A flag only moves a collection into "Hidden collections" (reversible).
const PATTERNS: RegExp[] = [
  /https?:\/\//i, /\bwww\./i, /\.(com|io|xyz|net|org|app|site|top|claims?|live|club|vip|cc)\b/i,
  /\b(claim|airdrop|reward|voucher|bonus|free\s*(mint|nft)|visit|redeem|giveaway|winner|gift)\b/i,
  /[​-‏⁠﻿]/,
];
export function isSuspiciousCollection(name: string, symbol: string): boolean {
  const text = `${name} ${symbol}`;
  return PATTERNS.some((p) => p.test(text));
}
