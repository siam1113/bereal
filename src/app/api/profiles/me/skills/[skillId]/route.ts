import { NextResponse } from "next/server";
import { removeSkill } from "@/lib/services/profile-service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = await params;
  await removeSkill(skillId);
  return NextResponse.json({ ok: true });
}
