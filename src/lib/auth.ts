import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import type { AccountStatus, UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: AccountStatus;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
  interface User {
    role: UserRole;
    status: AccountStatus;
  }
}

// Deliberately not using `declare module "next-auth/jwt"` here: that module's own .d.ts
// pulls in @auth/core type barrels that reference optional peer packages (nodemailer,
// @simplewebauthn/*) we don't install, which breaks TS's augmentation resolution even
// with skipLibCheck. Narrow the token type inline at the call sites instead.
type AppJwt = {
  id?: string;
  role?: UserRole;
  status?: AccountStatus;
  [key: string]: unknown;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user?.passwordHash) return null;
        if (user.status === "SUSPENDED" || user.status === "DELETED") return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const t = token as AppJwt;
      if (user) {
        t.id = user.id;
        t.role = user.role;
        t.status = user.status;
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as AppJwt;
      session.user.id = t.id ?? session.user.id;
      session.user.role = t.role ?? session.user.role;
      session.user.status = t.status ?? session.user.status;
      return session;
    },
  },
});
