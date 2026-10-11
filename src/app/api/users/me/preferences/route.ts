import { NextResponse } from "next/server";
import { z } from "zod";
import { UnauthorizedError } from "@/lib/auth-helpers";
import { getNavPosition, updateNavPosition } from "@/lib/services/user-preferences-service";

const schema = z.object({
  navPosition: z.enum(["LEFT", "RIGHT", "TOP", "BOTTOM"]),
});

export async function GET() {
  const navPosition = await getNavPosition();
  return NextResponse.json({ navPosition });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const user = await updateNavPosition(parsed.data.navPosition);
    return NextResponse.json({ navPosition: user.navPosition });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}
