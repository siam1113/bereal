import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ADMIN_PREFIX = "/admin";
const AUTH_REQUIRED_PREFIXES = ["/settings", "/messages", "/notifications", ADMIN_PREFIX];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const needsAuth = AUTH_REQUIRED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith(ADMIN_PREFIX) && user.role !== "ADMIN" && user.role !== "MODERATOR") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/settings/:path*", "/messages/:path*", "/notifications/:path*", "/admin/:path*"],
};
