import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteAccountButton } from "./delete-account-button";

export default async function PrivacySettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings/privacy");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">Privacy</h1>

      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Location</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Your profile only ever shows city/region/country labels. Proverse never displays or
            shares your exact address or precise coordinates, even for &quot;local&quot;
            search.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Portfolio visibility</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Each portfolio item has its own visibility setting (public, connections, or
            private).
          </p>
          <Link href="/settings/portfolio" className="mt-2 inline-block text-sm text-accent hover:underline">
            Review portfolio visibility →
          </Link>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Relationship visibility</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Visibility on a relationship is yours alone to control — changing it never affects
            what the other party sees on their own profile.
          </p>
          <Link href="/relationships" className="mt-2 inline-block text-sm text-accent hover:underline">
            Manage relationship visibility →
          </Link>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Delete account</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Removes your login, name, and email. Shared-history records other people hold
            about you (relationships, feedback, endorsements) are preserved.
          </p>
          <div className="mt-3">
            <DeleteAccountButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
