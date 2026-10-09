import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listVisibleTeamHistoryForProject } from "@/lib/services/team-history-service";

/** "Who worked together, on what, when" for a single project — filtered to what the viewer may see. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const history = await listVisibleTeamHistoryForProject(id, user?.id ?? null);
  return NextResponse.json(history);
}
