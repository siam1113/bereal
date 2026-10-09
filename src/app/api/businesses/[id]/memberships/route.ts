import { NextResponse } from "next/server";
import { claimBusinessMembership, listMembershipsForOwner } from "@/lib/services/business-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memberships = await listMembershipsForOwner(id);
  return NextResponse.json({ memberships });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await claimBusinessMembership(id);
  return NextResponse.json({ membership });
}
