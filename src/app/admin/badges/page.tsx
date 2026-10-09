import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  awardBadge,
  createBadgeDefinition,
  listAwardsForDefinition,
  listBadgeDefinitions,
  revokeBadge,
  setBadgeDefinitionActive,
} from "@/lib/services/admin-badge-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

async function createDefinitionAction(formData: FormData) {
  "use server";
  await requireAdmin();
  await createBadgeDefinition({
    slug: String(formData.get("slug")),
    name: String(formData.get("name")),
    description: String(formData.get("description")),
    kind: String(formData.get("kind")) as "CLAIM_VERIFICATION" | "FEEDBACK_ATTRIBUTE" | "ACHIEVEMENT",
    criteria: {},
  });
  revalidatePath("/admin/badges");
}

async function toggleActiveAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  await setBadgeDefinitionActive(id, !isActive);
  revalidatePath("/admin/badges");
}

async function awardAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const badgeDefinitionId = String(formData.get("badgeDefinitionId"));
  const email = String(formData.get("email")).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  await awardBadge(badgeDefinitionId, user.id, admin.id);
  revalidatePath("/admin/badges");
}

async function revokeAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const awardId = String(formData.get("awardId"));
  await revokeBadge(awardId, "Revoked by admin", admin.id);
  revalidatePath("/admin/badges");
}

export default async function AdminBadgesPage() {
  const definitions = await listBadgeDefinitions();
  const awardsByDefinition = await Promise.all(
    definitions.map((d) => listAwardsForDefinition(d.id)),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-ink">Badge definitions</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New badge definition</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDefinitionAction} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" required placeholder="e.g. punctual-collaborator" />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" required />
            </div>
            <div>
              <Label htmlFor="kind">Kind</Label>
              <Select name="kind" defaultValue="ACHIEVEMENT">
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLAIM_VERIFICATION">Claim verification</SelectItem>
                  <SelectItem value="FEEDBACK_ATTRIBUTE">Feedback attribute</SelectItem>
                  <SelectItem value="ACHIEVEMENT">Achievement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="self-start">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {definitions.map((def, i) => (
          <Card key={def.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{def.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={def.isActive ? "success" : "neutral"}>
                    {def.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <form action={toggleActiveAction}>
                    <input type="hidden" name="id" value={def.id} />
                    <input type="hidden" name="isActive" value={String(def.isActive)} />
                    <Button size="sm" variant="secondary" type="submit">
                      {def.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-sm text-ink-muted">{def.description}</p>

              <form action={awardAction} className="flex items-end gap-2">
                <input type="hidden" name="badgeDefinitionId" value={def.id} />
                <div className="flex-1">
                  <Label htmlFor={`email-${def.id}`}>Award to (email)</Label>
                  <Input id={`email-${def.id}`} name="email" type="email" required />
                </div>
                <Button size="sm" type="submit">
                  Award
                </Button>
              </form>

              <div className="flex flex-col gap-2">
                {awardsByDefinition[i].map((award) => (
                  <div
                    key={award.id}
                    className="flex items-center justify-between rounded-md bg-paper px-3 py-2 text-sm"
                  >
                    <span>
                      {award.recipient.name ?? award.recipient.email} ·{" "}
                      <span className="text-ink-muted">{award.status}</span>
                    </span>
                    {award.status === "ACTIVE" ? (
                      <form action={revokeAction}>
                        <input type="hidden" name="awardId" value={award.id} />
                        <Button size="sm" variant="danger" type="submit">
                          Revoke
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
