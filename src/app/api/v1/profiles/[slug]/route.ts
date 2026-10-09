import { apiJson } from "@/lib/api/http";
import { getProfileBySlug } from "@/lib/services/profile-service";

/**
 * Public profile view — same data `/p/[slug]` renders server-side, same visibility
 * filtering (`getProfileBySlug` already restricts portfolio items to `PUBLIC`). No auth
 * required, matching the web page it mirrors: a signed-out visitor can view a profile
 * today, so a signed-out API client can too.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) return apiJson({ error: "Not found" }, { status: 404 });
  return apiJson({ profile });
}
