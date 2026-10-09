import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioItemForm } from "@/components/portfolio/portfolio-item-form";
import { getOwnPortfolioItem } from "@/lib/services/portfolio-service";

export default async function EditPortfolioItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getOwnPortfolioItem(id).catch(() => null);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Edit portfolio item</CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioItemForm
            itemId={item.id}
            initial={{
              title: item.title,
              description: item.description ?? "",
              tags: item.tags.join(", "),
              visibility: item.visibility,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
