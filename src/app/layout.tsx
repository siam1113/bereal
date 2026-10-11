import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { AppRightRail } from "@/components/app-right-rail";
import { AppTopNav } from "@/components/app-top-nav";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { Toaster } from "@/components/ui/toaster";
import { getNavPosition } from "@/lib/services/user-preferences-service";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Proverse — Every skill deserves to be seen",
  description:
    "A people-first professional discovery and relationship network for every kind of skill.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const navPosition = await getNavPosition();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper font-sans">
        {navPosition === "TOP" ? <AppTopNav /> : null}
        {navPosition === "BOTTOM" ? <AppTopNav minimal /> : null}

        <div className="mx-auto flex w-full max-w-[1320px]">
          {navPosition === "LEFT" ? <AppSidebar /> : null}

          <main
            className={
              navPosition === "LEFT" || navPosition === "RIGHT"
                ? "min-h-dvh w-full min-w-0 flex-1 border-border pb-16 md:border-x md:pb-0"
                : "min-h-dvh w-full min-w-0 flex-1 pb-20"
            }
          >
            {children}
          </main>

          {navPosition === "LEFT" ? <AppRightRail /> : null}
          {navPosition === "RIGHT" ? <AppSidebar /> : null}
        </div>

        {navPosition === "LEFT" || navPosition === "RIGHT" ? (
          <AppBottomNav mode="mobile-only" />
        ) : null}
        {navPosition === "BOTTOM" ? <AppBottomNav mode="always" /> : null}

        <Toaster />
      </body>
    </html>
  );
}
