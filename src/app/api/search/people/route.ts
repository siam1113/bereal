import { NextResponse } from "next/server";
import { searchPeople } from "@/lib/services/search-service";
import type { AvailabilityStatus, GeoScope, ProfessionalStage } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const results = await searchPeople({
    query: searchParams.get("q") ?? undefined,
    skillId: searchParams.get("skillId") ?? undefined,
    geoScope: (searchParams.get("geoScope") as GeoScope | null) ?? undefined,
    nearProfileId: searchParams.get("nearProfileId") ?? undefined,
    availability: (searchParams.get("availability") as AvailabilityStatus | null) ?? undefined,
    stage: (searchParams.get("stage") as ProfessionalStage | null) ?? undefined,
  });
  return NextResponse.json({ results });
}
