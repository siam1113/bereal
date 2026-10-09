import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listMyClaims } from "@/lib/services/claim-service";
import { ClaimManager } from "./claim-manager";

export default async function ClaimsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/claims");

  const claims = await listMyClaims(user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">Claims</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Identity, experience, credential, project/work, and competency claims you&apos;ve
        submitted for review.
      </p>
      <ClaimManager
        claims={claims.map((c) => ({
          id: c.id,
          claimType: c.claimType,
          title: c.title,
          status: c.status,
          submittedAt: c.submittedAt.toISOString(),
        }))}
      />
    </div>
  );
}
