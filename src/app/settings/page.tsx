import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { Card, CardContent } from "@/components/ui/card";

const SECTIONS = [
  { href: "/settings/profile", label: "Profile", description: "Name, bio, location, availability, skills." },
  { href: "/settings/portfolio", label: "Portfolio", description: "Work samples and project images." },
  { href: "/settings/experience", label: "Experience", description: "Roles, projects, and engagements." },
  { href: "/settings/businesses", label: "Businesses", description: "Business pages you own or belong to." },
  { href: "/settings/services", label: "Services", description: "Service offerings you list for inquiries." },
  { href: "/relationships", label: "Relationships", description: "Manage ties, requests, and visibility." },
  { href: "/claims", label: "Claims", description: "Identity, credential, and project claims under review." },
  {
    href: "/references",
    label: "References",
    description: "Structured references you've given and received, from confirmed relationships.",
  },
  {
    href: "/settings/appearance",
    label: "Appearance",
    description: "Choose where the main navigation appears.",
  },
  { href: "/settings/privacy", label: "Privacy", description: "Account deletion and data visibility." },
  {
    href: "/settings/api-keys",
    label: "API keys",
    description: "Scoped tokens for scripts and non-browser clients.",
  },
];

export default async function SettingsIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">Settings</h1>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:border-border-strong">
              <CardContent className="p-4">
                <p className="font-medium text-ink">{section.label}</p>
                <p className="mt-1 text-sm text-ink-muted">{section.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
