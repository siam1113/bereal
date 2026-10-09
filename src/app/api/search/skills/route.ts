import { NextResponse } from "next/server";
import { searchSkillsForPicker } from "@/lib/services/search-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const skills = await searchSkillsForPicker(q);
  return NextResponse.json({ skills });
}
