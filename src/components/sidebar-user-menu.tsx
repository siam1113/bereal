"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarUserMenuProps {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  isAdmin: boolean;
  profileSlug: string | null;
}

export function SidebarUserMenu({ name, email, image, isAdmin, profileSlug }: SidebarUserMenuProps) {
  const initials = (name || email || "?").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-full p-2 text-left transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent xl:p-2.5">
        <Avatar>
          {image ? <AvatarImage src={image} alt={name ?? "Profile"} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden min-w-0 flex-1 xl:block">
          <span className="block truncate text-sm font-semibold text-ink">{name ?? "Account"}</span>
          <span className="block truncate text-xs text-ink-muted">{email}</span>
        </span>
        <MoreHorizontal className="hidden h-5 w-5 shrink-0 text-ink-muted xl:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {profileSlug ? (
          <DropdownMenuItem asChild>
            <Link href={`/p/${profileSlug}`}>View profile</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/claims">Claims</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/references">References</Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">Admin dashboard</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
