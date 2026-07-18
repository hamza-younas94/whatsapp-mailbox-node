/**
 * Detect the dominant script of a text run so we can apply the right font + direction.
 * Urdu and Arabic share the Arabic block, so we distinguish by Urdu-specific letters
 * (retroflex ٹ ڈ ڑ, ں, ہ/ھ, ے, گ چ پ ژ, Urdu ی/ک). If none present but Arabic-block
 * chars exist, treat it as Arabic.
 */
export type TextScript = 'urdu' | 'arabic' | 'ltr';

// Letters that appear in Urdu but not standard Arabic.
const URDU_SPECIFIC = /[ٹڈڑںھہۂۃےگچپژکیۓ]/;
// Any Arabic-block / Arabic-supplement character.
const ARABIC_BLOCK = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function detectScript(text?: string | null): TextScript {
  if (!text) return 'ltr';
  if (URDU_SPECIFIC.test(text)) return 'urdu';
  if (ARABIC_BLOCK.test(text)) return 'arabic';
  return 'ltr';
}

/** CSS class to apply for a given text run. */
export function scriptClass(text?: string | null): string {
  return `script-${detectScript(text)}`;
}
