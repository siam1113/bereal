import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { listMyBookings, listMyHostedSessions } from "@/lib/services/expert-session-service";

export async function GET() {
  const user = await requireUser();
  const [hosted, booked] = await Promise.all([listMyHostedSessions(user.id), listMyBookings(user.id)]);
  return NextResponse.json({ hosted, booked });
}
