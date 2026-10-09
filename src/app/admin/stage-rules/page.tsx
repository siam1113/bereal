import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SkillCategoryGroup } from "@prisma/client";

const CRITERIA: Record<SkillCategoryGroup, string> = {
  TRADES: "Established: 5+ years practicing OR 10+ documented projects with portfolio evidence. Practicing: 2+ years or 3+ documented projects. Emerging: at least one documented project. Learning: no documented practice yet.",
  ARTS: "Established: sustained public exhibition/sale history or 10+ portfolio pieces over 3+ years. Practicing: regular shown work, 2+ years. Emerging: early portfolio, under 2 years. Learning: still studying fundamentals.",
  AGRICULTURE: "Established: 5+ seasons operating independently or consulting. Practicing: 2+ seasons. Emerging: first season(s), supervised. Learning: training/apprenticing.",
  HEALTHCARE_ADJACENT: "Established: 5+ years non-clinical care experience with confirmed work history. Practicing: 2+ years. Emerging: under 2 years, some confirmed experience. Learning: in training.",
  TECHNOLOGY: "Established: 6+ years professional experience or equivalent shipped-project evidence. Practicing: 2-6 years. Emerging: under 2 years professional, has shipped projects. Learning: personal projects only.",
  BUSINESS_PROFESSIONAL: "Established: 6+ years consulting/advisory experience with confirmed engagements. Practicing: 2-6 years. Emerging: under 2 years. Learning: training/shadowing.",
  OTHER: "No category-specific rule yet — falls back to the TRADES-equivalent generic criteria above.",
};

async function recomputeAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const personSkillId = String(formData.get("personSkillId"));
  const stage = String(formData.get("stage")) as
    | "LEARNING"
    | "EMERGING"
    | "PRACTICING"
    | "ESTABLISHED";
  const rationale = String(formData.get("rationale") ?? "");
  await prisma.personSkill.update({
    where: { id: personSkillId },
    data: {
      stage,
      stageUpdatedAt: new Date(),
      stageRationale: { manual: true, note: rationale },
    },
  });
  revalidatePath("/admin/stage-rules");
}

export default async function AdminStageRulesPage() {
  const personSkills = await prisma.personSkill.findMany({
    include: {
      personProfile: { select: { displayName: true, slug: true } },
      skill: { select: { name: true, categoryGroup: true } },
    },
    orderBy: { stageUpdatedAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Professional stage rules</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          <strong>Known V1 simplification:</strong> stage is assigned from the criteria below
          read by a human reviewer, not a fully automated per-profession rules engine. A real
          rules engine (parsing portfolio/experience evidence automatically) is a post-V1 item —
          see plan section 10.
        </p>
      </div>

      <div className="grid gap-3">
        {(Object.keys(CRITERIA) as SkillCategoryGroup[]).map((group) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="text-sm">{group.replaceAll("_", " ")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-ink-muted">{CRITERIA[group]}</CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">
          Recompute an individual stage (most recently updated 50)
        </h2>
        <div className="flex flex-col gap-3">
          {personSkills.map((ps) => (
            <Card key={ps.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink">
                    {ps.personProfile.displayName} — {ps.skill.name}
                    {ps.isPrimary ? <Badge className="ml-2">primary</Badge> : null}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {ps.skill.categoryGroup} · current: {ps.stage}
                  </p>
                </div>
                <form action={recomputeAction} className="flex items-center gap-2">
                  <input type="hidden" name="personSkillId" value={ps.id} />
                  <Select name="stage" defaultValue={ps.stage}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEARNING">Learning</SelectItem>
                      <SelectItem value="EMERGING">Emerging</SelectItem>
                      <SelectItem value="PRACTICING">Practicing</SelectItem>
                      <SelectItem value="ESTABLISHED">Established</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    name="rationale"
                    placeholder="Rationale"
                    className="h-8 w-48 text-xs"
                    defaultValue={
                      typeof ps.stageRationale === "object" &&
                      ps.stageRationale &&
                      "note" in ps.stageRationale
                        ? String((ps.stageRationale as { note?: string }).note ?? "")
                        : ""
                    }
                  />
                  <Button size="sm" type="submit">
                    Save
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
