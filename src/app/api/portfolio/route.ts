import { NextResponse } from "next/server";
import { z } from "zod";
import { createPortfolioItem, listOwnPortfolioItems } from "@/lib/services/portfolio-service";

const schema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  images: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
  dateOccurred: z.string().nullable().optional(),
  visibility: z.enum(["PUBLIC", "CONNECTIONS", "PRIVATE"]).optional(),
  skillIds: z.array(z.string()).optional(),
});

export async function GET() {
  const items = await listOwnPortfolioItems();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const item = await createPortfolioItem(parsed.data);
  return NextResponse.json({ item });
}
