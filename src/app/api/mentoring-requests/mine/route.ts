import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { listMyMentoringRequests } from "@/lib/services/mentoring-service";

export async function GET() {
  const user = await requireUser();
  const requests = await listMyMentoringRequests(user.id);
  return NextResponse.json({ requests });
}
