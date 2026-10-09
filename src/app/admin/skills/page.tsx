import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  approveSkill,
  listApprovedSkills,
  listPendingSkills,
  mergeSkill,
  rejectSkill,
} from "@/lib/services/admin-skill-service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

async function approveAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  await approveSkill(String(formData.get("skillId")), admin.id);
  revalidatePath("/admin/skills");
}

async function rejectAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  await rejectSkill(String(formData.get("skillId")), admin.id);
  revalidatePath("/admin/skills");
}

async function mergeAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const duplicateSkillId = String(formData.get("skillId"));
  const canonicalSkillId = String(formData.get("canonicalSkillId"));
  if (!canonicalSkillId) return;
  await mergeSkill(duplicateSkillId, canonicalSkillId, admin.id);
  revalidatePath("/admin/skills");
}

export default async function AdminSkillsPage() {
  const [pending, approved] = await Promise.all([listPendingSkills(), listApprovedSkills()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-ink">Skill taxonomy</h1>
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">
          Pending suggestions ({pending.length})
        </h2>
        <div className="flex flex-col gap-3">
          {pending.length === 0 ? (
            <p className="text-sm text-ink-muted">No free-text suggestions waiting on review.</p>
          ) : null}
          {pending.map((skill) => (
            <Card key={skill.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink">{skill.name}</p>
                  <p className="text-xs text-ink-muted">
                    slug: {skill.slug} · suggested by{" "}
                    {skill.suggestedBy?.name ?? skill.suggestedBy?.email ?? "unknown"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={approveAction}>
                    <input type="hidden" name="skillId" value={skill.id} />
                    <Button size="sm" type="submit">
                      Approve
                    </Button>
                  </form>
                  <form action={mergeAction} className="flex items-center gap-2">
                    <input type="hidden" name="skillId" value={skill.id} />
                    <Select name="canonicalSkillId">
                      <SelectTrigger className="h-8 w-48 text-xs">
                        <SelectValue placeholder="Merge into…" />
                      </SelectTrigger>
                      <SelectContent>
                        {approved
                          .filter((a) => a.id !== skill.id)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="secondary" type="submit">
                      Merge
                    </Button>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="skillId" value={skill.id} />
                    <Button size="sm" variant="danger" type="submit">
                      Reject
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">
          Approved skills ({approved.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {approved.map((skill) => (
            <span
              key={skill.id}
              className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-ink"
            >
              {skill.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
