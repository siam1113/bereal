/**
 * Shared gate for every AI-assistance feature (Track 8 — see
 * docs/roadmap/08-ai-assistance.md) that would otherwise send user-authored content
 * (search text, bios, portfolio notes, messages) to a third-party LLM API.
 *
 * POLICY — NOT DECIDED: whether user content may be sent to a third-party API at all,
 * which model/provider to use, and what data-retention terms apply have NOT been
 * signed off by anyone with product authority (see this track's final report and the
 * "Policy questions to flag, not decide silently" section of the roadmap doc). This
 * module exists so that question has exactly one place to answer "yes" — flip
 * AI_EXTERNAL_PROVIDER_ENABLED — rather than being implicitly decided per-feature.
 *
 * Default posture: disabled. Every AI-assistance service under
 * src/lib/services/ai-*.ts MUST have a local, deterministic, non-network
 * implementation it falls back to when this is disabled (or when the network call
 * fails) — never silently skip the feature, and never call out to a third party unless
 * both AI_EXTERNAL_PROVIDER_ENABLED="true" and ANTHROPIC_API_KEY are explicitly set.
 */

export function isExternalAiProviderEnabled(): boolean {
  return process.env.AI_EXTERNAL_PROVIDER_ENABLED === "true" && Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface ExternalCompletionInput {
  /** System instructions — always scoped to "only use what you're given, never invent facts". */
  system: string;
  /** The user-authored text being sent externally. Callers are responsible for only
   *  including what's actually needed for the task (see each service's docstring). */
  prompt: string;
  maxTokens?: number;
}

/**
 * Raw `fetch` call to Anthropic's Messages API — deliberately no SDK dependency for one
 * call shape, so this track doesn't need to add a new package to pnpm's lockfile for a
 * feature that's off by default.
 *
 * Only ever invoked when isExternalAiProviderEnabled() is true. Callers MUST check that
 * themselves and have a local fallback ready regardless — this throws on any
 * non-2xx/parse failure rather than returning a sentinel, by design, so a caller can't
 * accidentally treat a failed call as a successful empty response.
 */
export async function callExternalCompletion(input: ExternalCompletionInput): Promise<string> {
  if (!isExternalAiProviderEnabled()) {
    throw new Error("External AI provider is disabled (set AI_EXTERNAL_PROVIDER_ENABLED=true and ANTHROPIC_API_KEY to enable).");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: input.maxTokens ?? 512,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`External AI provider error: ${response.status} ${await response.text().catch(() => "")}`);
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("External AI provider returned no text content");
  return text;
}

/** Pulls the first top-level JSON object out of a model response, tolerating any
 *  surrounding prose the model added despite being asked not to. */
export function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response");
  }
  return raw.slice(start, end + 1);
}
