import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser, WeakPasswordError } from "@/lib/services/auth-service";
import { rateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(120),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`register:${ip}`, 5, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many attempts, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await registerUser(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof WeakPasswordError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
