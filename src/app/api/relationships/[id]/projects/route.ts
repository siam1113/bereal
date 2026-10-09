import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import {
  RelationshipAuthError,
  RelationshipStateError,
} from "@/lib/services/relationship-service";
import { anchorRelationshipToProject, listProjectsForRelationship } from "@/lib/services/team-history-service";

const schema = z.object({
  portfolioItemId: z.string().min(1),
  note: z.string().max(2000).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const links = await listProjectsForRelationship(id);
  return NextResponse.json(links);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const link = await anchorRelationshipToProject({
      relationshipId: id,
      addedByUserId: user.id,
      ...parsed.data,
    });
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    if (err instanceof RelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof RelationshipStateError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
