import { apiJson } from "@/lib/api/http";
import { searchSkillsForPicker } from "@/lib/services/search-service";

/** Public, same as the legacy /api/search/skills. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const skills = await searchSkillsForPicker(q);
  return apiJson({ skills });
}
