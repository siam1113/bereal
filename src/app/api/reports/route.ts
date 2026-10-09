import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { createReport } from "@/lib/services/report-service";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  targetType: z.enum(["USER", "POST", "COMMENT", "MESSAGE", "RELATIONSHIP", "BUSINESS", "PORTFOLIO_ITEM"]),
  targetId: z.string().min(1),
  targetUserId: z.string().optional(),
  reason: z.string().min(1).max(200),
  details: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const user = await requireUser();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!rateLimit(`report:${user.id}:${parsed.data.targetType}:${parsed.data.targetId}`, 1, 60 * 1000).ok) {
    return NextResponse.json({ error: "You already reported this recently" }, { status: 429 });
  }

  const report = await createReport({ reporterUserId: user.id, ...parsed.data });
  return NextResponse.json({ report }, { status: 201 });
}
