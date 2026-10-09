import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { assignReviewCase, listReviewCases, setReviewCaseStatus } from "@/lib/services/review-case-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

async function claimAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const reviewCaseId = String(formData.get("reviewCaseId"));
  await assignReviewCase(reviewCaseId, admin.id, admin.id);
  revalidatePath("/admin/review-cases");
}

async function startAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const reviewCaseId = String(formData.get("reviewCaseId"));
  await setReviewCaseStatus(reviewCaseId, "IN_PROGRESS", admin.id);
  revalidatePath("/admin/review-cases");
}

const statusVariant = {
  OPEN: "neutral",
  ASSIGNED: "warning",
  IN_PROGRESS: "warning",
  ESCALATED: "danger",
  RESOLVED: "success",
  CLOSED: "neutral",
} as const;

const DECISION_LINK: Record<string, (entityId: string) => string> = {
  CREDENTIAL_CLAIM: (id) => `/admin/claims/${id}`,
  RELATIONSHIP_DISPUTE: () => `/admin/disputes`,
  MODERATION_FLAG: () => `/admin/flags`,
};

function isOverdue(slaDueAt: Date | null) {
  return slaDueAt !== null && slaDueAt.getTime() < Date.now();
}

export default async function AdminReviewCasesPage() {
  const openCases = await listReviewCases({ status: ["OPEN", "ASSIGNED", "IN_PROGRESS", "ESCALATED"] });
  const closedCases = await listReviewCases({ status: ["RESOLVED", "CLOSED"] });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-ink">Review queues</h1>
      <p className="text-sm text-ink-muted">
        The generic SLA/tier/assignment workspace across verification claims, relationship
        disputes, and escalated abuse flags. The actual decision (approve/reject, uphold/
        dismiss) still happens on each item&apos;s own page — linked below.
      </p>

      <div className="flex flex-col gap-3">
        {openCases.length === 0 ? <p className="text-sm text-ink-muted">No open review cases.</p> : null}
        {openCases.map((reviewCase) => {
          const link = DECISION_LINK[reviewCase.entityType]?.(reviewCase.entityId);
          return (
            <Card key={reviewCase.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">
                    {reviewCase.caseType} · {reviewCase.entityType}:{reviewCase.entityId}
                  </p>
                  <div className="flex gap-2">
                    {reviewCase.tier ? <Badge variant="outline">{reviewCase.tier}</Badge> : null}
                    <Badge variant={reviewCase.priority === "URGENT" ? "danger" : "neutral"}>
                      {reviewCase.priority}
                    </Badge>
                    <Badge variant={statusVariant[reviewCase.status]}>{reviewCase.status}</Badge>
                  </div>
                </div>
                <p className="text-xs text-ink-muted">
                  Subject: {reviewCase.subject?.name ?? reviewCase.subject?.email ?? "—"} · Assigned:{" "}
                  {reviewCase.assignedTo?.name ?? reviewCase.assignedTo?.email ?? "Unassigned"} · SLA due{" "}
                  {reviewCase.slaDueAt ? reviewCase.slaDueAt.toLocaleString() : "—"}
                  {isOverdue(reviewCase.slaDueAt) ? (
                    <span className="ml-2 font-medium text-danger">OVERDUE</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  {!reviewCase.assignedToUserId ? (
                    <form action={claimAction}>
                      <input type="hidden" name="reviewCaseId" value={reviewCase.id} />
                      <Button type="submit" variant="secondary">
                        Claim this case
                      </Button>
                    </form>
                  ) : reviewCase.status === "ASSIGNED" ? (
                    <form action={startAction}>
                      <input type="hidden" name="reviewCaseId" value={reviewCase.id} />
                      <Button type="submit" variant="secondary">
                        Mark in progress
                      </Button>
                    </form>
                  ) : null}
                  {link ? (
                    <a href={link} className="text-sm text-accent underline">
                      Go decide →
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Closed ({closedCases.length})</h2>
        <div className="flex flex-col gap-2">
          {closedCases.map((reviewCase) => (
            <Card key={reviewCase.id}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <p>
                  {reviewCase.caseType} · {reviewCase.entityType}:{reviewCase.entityId} · {reviewCase.outcome ?? "—"}
                </p>
                <Badge variant="neutral">{reviewCase.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
