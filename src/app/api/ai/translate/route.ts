import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { translateText } from "@/lib/services/ai-translation-service";

const schema = z.object({
  text: z.string().min(1).max(4000),
  targetLocale: z.string().min(2).max(10),
});

/**
 * On-demand translation for display — never mutates stored content. The response
 * always carries the original text alongside the translation (or an "unavailable"
 * result when the external provider is disabled, which is the default — see
 * src/lib/services/ai-translation-service.ts and this track's final report on the
 * open policy question around sending user content to a third-party API).
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`ai-translate:${user.id}`, 30, 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests, slow down" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await translateText(parsed.data.text, parsed.data.targetLocale);
  return NextResponse.json({ result });
}
