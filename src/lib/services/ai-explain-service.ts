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
 * Resolved cross-track note: Track 1's trigram/tsvector ranking landed, but it was
 * deliberately kept separate from `matchReasons` — the roadmap's explainability
 * invariant means ranking can reorder results without a blended score replacing this
 * breakdown, so `matchReasons`'s shape (skillMatch / geoMatch / hasPortfolio /
 * availability) is unchanged and this function needed no update once Track 1 merged.
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
