import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnProfile, updateOwnProfile } from "@/lib/services/profile-service";

const schema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(2000).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  languages: z.array(z.string()).optional(),
  availability: z.enum(["OPEN_TO_WORK", "OPEN_TO_COLLAB", "LIMITED", "NOT_AVAILABLE"]).optional(),
});

export async function GET() {
  const profile = await getOwnProfile();
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const profile = await updateOwnProfile(parsed.data);
  return NextResponse.json({ profile });
}
