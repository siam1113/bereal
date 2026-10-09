import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { createHelpRequest, listHelpRequests } from "@/lib/services/help-request-service";

const createSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(10),
  skillId: z.string().optional(),
  geoScope: z.enum(["LOCAL", "REGION", "GLOBAL"]),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skillId = searchParams.get("skillId") ?? undefined;
  const geoScope = (searchParams.get("geoScope") as "LOCAL" | "REGION" | "GLOBAL" | null) ?? undefined;
  const helpRequests = await listHelpRequests({ skillId, geoScope });
  return NextResponse.json({ helpRequests });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await createHelpRequest(user.id, parsed.data);
  return NextResponse.json({ helpRequest: created }, { status: 201 });
}
