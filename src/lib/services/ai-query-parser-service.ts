import { prisma } from "@/lib/prisma";
import type { AvailabilityStatus, GeoScope } from "@prisma/client";
import { callExternalCompletion, extractJsonObject, isExternalAiProviderEnabled } from "@/lib/ai-provider";

export type ParseSource = "LOCAL_HEURISTIC" | "EXTERNAL_LLM";

export interface ParsedSearchQuery {
  /** Pass straight through to search-service.ts#searchPeople's free-text `query`. */
  query: string;
  skillId?: string;
  matchedSkillName?: string;
  geoScope?: GeoScope;
  availability?: AvailabilityStatus;
  source: ParseSource;
  /** Human-readable, shown to the user so the parse is never an opaque black box. */
  parseNotes: string[];
}

const GEO_LOCAL_WORDS = ["local", "nearby", "near me", "in my area", "my city", "close by", "around here"];
const GEO_REGION_WORDS = ["region", "statewide", "nationwide", "in my country", "my state", "my province"];
const GEO_GLOBAL_WORDS = ["global", "worldwide", "anywhere", "remote", "remotely", "online", "world wide"];
const URGENCY_WORDS = ["this week", "urgently", "urgent", "asap", "right away", "available now", "immediately", "today", "now"];

/**
 * Parses a free-text need ("need someone to fix a cabinet locally this week") into the
 * structured params search-service.ts#searchPeople already accepts — a mapping layer in
 * front of Track 1's search, not a new ranking mechanism (docs/roadmap/08-ai-
 * assistance.md, "What to build" item 1).
 *
 * CROSS-TRACK NOTE: this worktree only has Track 1's current, unranked
 * search-service.ts (query/skillId/geoScope/availability/stage params, matchReasons =
 * {skillMatch, geoMatch, hasPortfolio, availability}). The roadmap doc says this track
 * depends on Track 1 landing ranked search with a richer matchReasons breakdown first;
 * that hasn't landed in this worktree, so this parser only ever targets the fields the
 * *current* searchPeople() accepts. Revisit once Track 1's actual output shape is
 * available (see this track's final report).
 *
 * Deliberately keyword/DB-lookup based by default — it never has to leave the server,
 * so the "can user content go to a third party" policy question this track must flag
 * doesn't even arise for the default path. An external-LLM-assisted parse exists behind
 * AI_EXTERNAL_PROVIDER_ENABLED (default off) for free text the local heuristic can't
 * handle; even then only the searcher's own free-text query is sent, and any skill the
 * model proposes is re-resolved against the real Skill table before use — it can never
 * surface a hallucinated skill as if it were real.
 */
export async function parseSearchQuery(text: string): Promise<ParsedSearchQuery> {
  const local = await parseLocally(text);
  if (!isExternalAiProviderEnabled()) return local;

  try {
    return await parseWithExternalProvider(text, local);
  } catch {
    // Disabled, network error, or a malformed model response — always fall back to the
    // local, no-network parse rather than failing the search.
    return local;
  }
}

async function parseLocally(text: string): Promise<ParsedSearchQuery> {
  const lower = text.toLowerCase();
  const notes: string[] = [];

  let geoScope: GeoScope | undefined;
  if (GEO_LOCAL_WORDS.some((w) => lower.includes(w))) {
    geoScope = "LOCAL";
    notes.push('Detected a "local" phrase — scoped to your city.');
  } else if (GEO_GLOBAL_WORDS.some((w) => lower.includes(w))) {
    geoScope = "GLOBAL";
    notes.push('Detected a "remote/worldwide" phrase — scoped globally.');
  } else if (GEO_REGION_WORDS.some((w) => lower.includes(w))) {
    geoScope = "REGION";
    notes.push('Detected a "region/country" phrase — scoped to your region.');
  }

  let availability: AvailabilityStatus | undefined;
  if (URGENCY_WORDS.some((w) => lower.includes(w))) {
    availability = "OPEN_TO_WORK";
    notes.push("Detected urgency language — filtering to people open to work.");
  }

  const bestMatch = await findBestSkillMatch(lower);
  if (bestMatch) notes.push(`Matched skill "${bestMatch.name}" from the text ("${bestMatch.term}").`);

  return {
    query: text,
    skillId: bestMatch?.id,
    matchedSkillName: bestMatch?.name,
    geoScope,
    availability,
    source: "LOCAL_HEURISTIC",
    parseNotes: notes,
  };
}

/**
 * Longest substring match wins, so "furniture finishing" beats "furniture" when both
 * are real skills/aliases. Loads the (V1-scale) skill taxonomy into memory rather than
 * pushing substring matching into SQL — same tradeoff search-service.ts already
 * documents for its own ILIKE-based matching; revisit if the taxonomy grows large.
 */
async function findBestSkillMatch(lowerText: string): Promise<{ id: string; name: string; term: string } | null> {
  const skills = await prisma.skill.findMany({
    where: { isApproved: true },
    include: { aliases: true },
  });

  let bestMatch: { id: string; name: string; term: string } | null = null;
  for (const skill of skills) {
    const terms = [skill.name, ...skill.aliases.map((a) => a.alias)];
    for (const term of terms) {
      if (term.length < 3) continue;
      if (lowerText.includes(term.toLowerCase())) {
        if (!bestMatch || term.length > bestMatch.term.length) {
          bestMatch = { id: skill.id, name: skill.name, term };
        }
      }
    }
  }
  return bestMatch;
}

interface ExternalParseShape {
  skillPhrase?: string | null;
  geoScope?: GeoScope | null;
  urgent?: boolean;
}

async function parseWithExternalProvider(text: string, local: ParsedSearchQuery): Promise<ParsedSearchQuery> {
  const raw = await callExternalCompletion({
    system:
      "Extract search intent from a short request for help on a skills-discovery site. " +
      'Respond with ONLY compact JSON: {"skillPhrase": string|null, "geoScope": ' +
      '"LOCAL"|"REGION"|"GLOBAL"|null, "urgent": boolean}. skillPhrase is your best ' +
      "plain-language guess at the skill/profession/trade needed, in a few words — not " +
      "an ID, not a person's name. Never invent facts beyond what the text says.",
    prompt: text,
    maxTokens: 200,
  });

  const parsed = JSON.parse(extractJsonObject(raw)) as ExternalParseShape;

  // The model only ever proposes a plain-text phrase — re-resolve it against the real
  // Skill table ourselves so a hallucinated/misremembered skill name can never surface
  // as if it were a real, existing skillId.
  let skillId = local.skillId;
  let matchedSkillName = local.matchedSkillName;
  if (!skillId && parsed.skillPhrase) {
    const candidate = await prisma.skill.findFirst({
      where: {
        isApproved: true,
        OR: [
          { name: { contains: parsed.skillPhrase, mode: "insensitive" } },
          { aliases: { some: { alias: { contains: parsed.skillPhrase, mode: "insensitive" } } } },
        ],
      },
    });
    if (candidate) {
      skillId = candidate.id;
      matchedSkillName = candidate.name;
    }
  }

  return {
    query: text,
    skillId,
    matchedSkillName,
    geoScope: parsed.geoScope ?? local.geoScope,
    availability: parsed.urgent ? "OPEN_TO_WORK" : local.availability,
    source: "EXTERNAL_LLM",
    parseNotes: [
      ...local.parseNotes,
      "Refined with an external LLM provider (AI_EXTERNAL_PROVIDER_ENABLED=true) — it only proposed a plain-text skill phrase, re-resolved against the real skill taxonomy before use.",
    ],
  };
}
