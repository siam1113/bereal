import type { SearchPersonResult } from "@/lib/services/search-service";
import type { ParsedSearchQuery } from "@/lib/services/ai-query-parser-service";

export interface MatchExplanation {
  profileId: string;
  summary: string;
  reasons: string[];
  /** Always local/template in V1 — see the docstring below for why. */
  source: "LOCAL_TEMPLATE";
}

/**
 * Turns a search result's `matchReasons` (search-service.ts) into a short,
 * plain-English explanation — grounded ONLY in fields already present on the result
 * object, never a free-floating LLM claim about a candidate's quality (docs/roadmap/
 * 08-ai-assistance.md, "What to build" item 2, and the track's core invariant: "every
 * suggestion must be traceable back to real stored evidence").
 *
 * Deliberately template-based, not LLM-based, even with the external provider enabled:
 * phrasing match reasons doesn't need a model, and keeping it local means this specific
 * piece carries zero external-call policy risk regardless of the AI_EXTERNAL_PROVIDER_
 * ENABLED setting.
 *
 * CROSS-TRACK GAP: built against today's *unranked* search-service.ts matchReasons
 * shape (skillMatch / geoMatch / hasPortfolio / availability) — not the richer, ranked
 * matchReasons breakdown Track 1 is supposed to land (this worktree does not have
 * Track 1's changes; see this track's final report). Revisit this function once Track
 * 1 ships its actual matchReasons shape: expand to cite whatever additional signals it
 * adds (e.g. a relevance-score breakdown), still never inventing anything beyond what
 * matchReasons actually contains.
 */
export function explainMatch(result: SearchPersonResult, parsed?: ParsedSearchQuery): MatchExplanation {
  const reasons: string[] = [];
  const { matchReasons } = result;

  if (matchReasons.skillMatch === "primary") {
    reasons.push(`"${result.matchedSkillName ?? "This skill"}" is their primary skill.`);
  } else if (matchReasons.skillMatch === "secondary") {
    reasons.push(`"${result.matchedSkillName ?? "This skill"}" is listed as a secondary skill.`);
  }

  if (matchReasons.geoMatch === "local") reasons.push("Based in your city.");
  else if (matchReasons.geoMatch === "region") reasons.push("Based in your region/country.");
  else if (matchReasons.geoMatch === "global") reasons.push("Matched globally (no location filter applied).");

  if (matchReasons.hasPortfolio) {
    reasons.push(`Has ${result.portfolioCount} portfolio item${result.portfolioCount === 1 ? "" : "s"} as evidence.`);
  }

  reasons.push(`Availability: ${matchReasons.availability.replaceAll("_", " ").toLowerCase()}.`);

  if (parsed?.parseNotes.length) {
    reasons.push(`From your request: ${parsed.parseNotes.join(" ")}`);
  }

  const summary = reasons.length > 0 ? `Matched because ${reasons[0].toLowerCase()}` : "Matched your search.";

  return { profileId: result.profileId, summary, reasons, source: "LOCAL_TEMPLATE" };
}
