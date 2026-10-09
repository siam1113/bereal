import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { deleteAccount } from "@/lib/services/auth-service";

export async function POST() {
  const user = await requireUser();
  const result = await deleteAccount(user.id);
  return NextResponse.json(result);
}
