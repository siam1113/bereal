"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  isAdmin: boolean;
  profileSlug: string | null;
}

export function UserMenu({ name, email, image, isAdmin, profileSlug }: UserMenuProps) {
  const initials = (name || email || "?").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <Avatar>
          {image ? <AvatarImage src={image} alt={name ?? "Profile"} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {profileSlug ? (
          <DropdownMenuItem asChild>
            <Link href={`/p/${profileSlug}`}>View profile</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/messages">Messages</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/relationships">Relationships</Link>
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
