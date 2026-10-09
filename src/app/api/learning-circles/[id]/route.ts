import { NextResponse } from "next/server";
import { getLearningCircle } from "@/lib/services/learning-circle-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const circle = await getLearningCircle(id);
  if (!circle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ circle });
}
