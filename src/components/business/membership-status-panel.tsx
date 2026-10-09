"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { Badge } from "@/components/ui/badge";
import { ClaimMembershipButton } from "@/components/business/claim-membership-button";

interface Membership {
  status: "PENDING" | "CONFIRMED" | "DISPUTED" | "REMOVED";
  verificationClaimId: string | null;
  verifiedAt: string | Date | null;
  verificationClaim: { status: string } | null;
}

/**
 * Shows the signed-in viewer their own membership state for this business, and the
 * next action available to them — claim, wait for owner confirmation, request
 * verification, or wait for admin review. Mirrors the self-declared -> owner-
 * confirmed -> verified tiers described in business-service.ts.
 */
export function MembershipStatusPanel({
  businessId,
  membership,
}: {
  businessId: string;
  membership: Membership | null;
}) {
  const router = useRouter();

  async function requestVerification() {
    const res = await fetch(`/api/businesses/${businessId}/memberships/verify`, { method: "POST" });
    if (!res.ok) {
      toast.error("Couldn't submit a verification request.");
      return;
    }
    toast.success("Verification requested — an admin will review it.");
    router.refresh();
  }

  if (!membership) {
    return <ClaimMembershipButton businessId={businessId} />;
  }

  if (membership.status === "PENDING") {
    return <Badge variant="warning">Membership pending owner confirmation</Badge>;
  }

  if (membership.status !== "CONFIRMED") {
    return <Badge variant="warning">{membership.status.toLowerCase()}</Badge>;
  }

  if (membership.verificationClaim?.status === "APPROVED") {
    return <Badge variant="success">You&apos;re a verified member</Badge>;
  }

  if (membership.verificationClaimId) {
    return <Badge variant="warning">Verification under admin review</Badge>;
  }

  return (
    <button onClick={requestVerification} className="text-sm text-accent hover:underline">
      Request verification
    </button>
  );
}
