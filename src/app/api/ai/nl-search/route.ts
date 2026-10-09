import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { parseSearchQuery } from "@/lib/services/ai-query-parser-service";
import { explainMatch } from "@/lib/services/ai-explain-service";
import { searchPeople } from "@/lib/services/search-service";

const schema = z.object({
  text: z.string().min(2).max(500),
});

/**
 * Natural-language search: parses free text into search-service.ts#searchPeople's
 * structured params, runs the existing ranked search (Track 1's trigram/tsvector
 * blend, now merged), and attaches a plain-English explanation to each result —
 * docs/roadmap/08-ai-assistance.md "What to build" items 1 and 2.
 *
 * Deliberately a separate route rather than editing /api/search/people — kept distinct
 * since this one layers NL parsing in front of the same underlying search.
 */
export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  const rateLimitKey = `ai-nl-search:${user?.id ?? "anon"}`;
  if (!rateLimit(rateLimitKey, 20, 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests, slow down" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = schema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }

  const parsedQuery = await parseSearchQuery(parsedBody.data.text);
  const { results } = await searchPeople({
    query: parsedQuery.skillId ? undefined : parsedQuery.query,
    skillId: parsedQuery.skillId,
    geoScope: parsedQuery.geoScope,
    availability: parsedQuery.availability,
  });
  const explanations = results.map((result) => explainMatch(result, parsedQuery));

  return NextResponse.json({ parsedQuery, results, explanations });
}
