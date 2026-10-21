import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { config } from "@/lib/config";

export function wordCount(): number {
  return config.recoveryWords;
}

export function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

export function createPhrase(): string {
  const strength = wordCount() === 24 ? 256 : 128;
  return generateMnemonic(wordlist, strength);
}

export function phraseValid(phrase: string): boolean {
  return validateMnemonic(normalizePhrase(phrase), wordlist);
}

export function quizIndexes(count = wordCount()): number[] {
  if (count >= 24) return [3, 12, 21];
  return [3, 7, 11];
}
