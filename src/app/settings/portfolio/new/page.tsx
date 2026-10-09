import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioItemForm } from "@/components/portfolio/portfolio-item-form";

export default function NewPortfolioItemPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Add portfolio item</CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioItemForm />
        </CardContent>
      </Card>
    </div>
  );
}
