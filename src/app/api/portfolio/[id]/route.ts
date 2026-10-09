import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePortfolioItem, getOwnPortfolioItem, updatePortfolioItem } from "@/lib/services/portfolio-service";

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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getOwnPortfolioItem(id);
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const item = await updatePortfolioItem(id, parsed.data);
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deletePortfolioItem(id);
  return NextResponse.json({ ok: true });
}
