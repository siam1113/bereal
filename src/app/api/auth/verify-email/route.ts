import { NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/auth-tokens";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?verified=0", request.url));
  }
  const result = await consumeEmailVerificationToken(token);
  return NextResponse.redirect(
    new URL(result.ok ? "/login?verified=1" : "/login?verified=0", request.url),
  );
}
