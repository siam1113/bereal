import { callExternalCompletion, isExternalAiProviderEnabled } from "@/lib/ai-provider";

export type TranslationSource = "EXTERNAL_LLM" | "UNAVAILABLE";

export interface TranslationResult {
  /** null = translation unavailable — never a fabricated guess presented as real. */
  translatedText: string | null;
  originalText: string;
  targetLocale: string;
  available: boolean;
  source: TranslationSource;
  /** UI-facing label; always render alongside the original text, never in place of it. */
  label: string;
}

/**
 * Machine translation of user-generated text for display (docs/roadmap/08-ai-
 * assistance.md, "What to build" item 4: "clearly labeled as translated, original
 * preserved"). This function never mutates or replaces stored content — callers keep
 * `originalText` and only additionally show `translatedText` next to it, labeled.
 *
 * There is no local/offline translation engine in this repo (adding one, or a
 * dependency on a translation API, is itself the policy question this track must
 * flag — see this track's final report), so with the external provider disabled (the
 * default) this honestly reports "unavailable" rather than faking a translation —
 * a wrong translation presented as real is worse than an honest "not available".
 */
export async function translateText(text: string, targetLocale: string): Promise<TranslationResult> {
  if (!isExternalAiProviderEnabled()) {
    return {
      translatedText: null,
      originalText: text,
      targetLocale,
      available: false,
      source: "UNAVAILABLE",
      label: "Translation unavailable — the AI translation provider is not enabled.",
    };
  }

  try {
    const translated = await callExternalCompletion({
      system:
        `Translate the user's text into locale "${targetLocale}". Respond with ONLY the ` +
        "translated text — no notes, no quotes, no explanation, no markdown.",
      prompt: text,
      maxTokens: Math.max(200, text.length * 2),
    });
    return {
      translatedText: translated.trim(),
      originalText: text,
      targetLocale,
      available: true,
      source: "EXTERNAL_LLM",
      label: `Translated to ${targetLocale} — original preserved below.`,
    };
  } catch {
    return {
      translatedText: null,
      originalText: text,
      targetLocale,
      available: false,
      source: "UNAVAILABLE",
      label: "Translation failed — showing original text only.",
    };
  }
}
