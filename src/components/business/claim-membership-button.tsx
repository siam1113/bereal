"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";

export function ClaimMembershipButton({ businessId }: { businessId: string }) {
  const router = useRouter();

  async function handleClick() {
    const res = await fetch(`/api/businesses/${businessId}/memberships`, { method: "POST" });
    if (!res.ok) {
      toast.error("Couldn't submit your membership claim.");
      return;
    }
    toast.success("Membership claim submitted — the owner needs to confirm it.");
    router.refresh();
  }

  return (
    <button onClick={handleClick} className="text-sm text-accent hover:underline">
      Claim membership
    </button>
  );
}
