import { customAlphabet } from "nanoid";

const suffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 5);

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "user"
  );
}

export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  while (await exists(candidate)) {
    candidate = `${root}-${suffix()}`;
  }
  return candidate;
}
