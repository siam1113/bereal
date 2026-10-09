import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { listMyCircles } from "@/lib/services/learning-circle-service";

export async function GET() {
  const user = await requireUser();
  const memberships = await listMyCircles(user.id);
  return NextResponse.json({ memberships });
}
