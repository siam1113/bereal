import { NextResponse } from "next/server";
import { searchSkills } from "@/lib/services/skill-service";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const skills = await searchSkills(q);
  return NextResponse.json({ skills });
}
