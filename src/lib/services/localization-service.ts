import { prisma } from "@/lib/prisma";

/**
 * Localized enum-value labels (professional stage names, skill category group names,
 * ...) — the same `locale`-column pattern `SkillAlias` already uses for skill names
 * (default `"en"`), generalized to a single table so it doesn't need a new model per
 * enum. This is groundwork only: V1 ships `en` rows equivalent to the hardcoded
 * `Record<string,string>` maps that used to live in page components (see
 * `seedDefaultLocalizedLabels()` below and docs/localization.md) — not translation
 * coverage for any other locale.
 *
 * `domain` is a free-text key matching a Prisma enum name by convention (not DB-enforced,
 * same tradeoff the schema comment on `LocalizedLabel` documents).
 */
export const LOCALIZATION_DOMAINS = {
  PROFESSIONAL_STAGE: "PROFESSIONAL_STAGE",
  SKILL_CATEGORY_GROUP: "SKILL_CATEGORY_GROUP",
  AVAILABILITY_STATUS: "AVAILABILITY_STATUS",
} as const;

export type LocalizationDomain = (typeof LOCALIZATION_DOMAINS)[keyof typeof LOCALIZATION_DOMAINS];

export const DEFAULT_LOCALE = "en";

/** All labels for a domain, keyed by enum value. Falls back to `en` if `locale` has no rows yet. */
export async function getLabels(
  domain: LocalizationDomain,
  locale: string = DEFAULT_LOCALE,
): Promise<Record<string, string>> {
  const rows = await prisma.localizedLabel.findMany({ where: { domain, locale } });
  if (rows.length === 0 && locale !== DEFAULT_LOCALE) {
    return getLabels(domain, DEFAULT_LOCALE);
  }
  return Object.fromEntries(rows.map((r) => [r.key, r.label]));
}

/** A single label. Falls back to `en`, then to the raw key, so a missing row never breaks a page. */
export async function getLabel(
  domain: LocalizationDomain,
  key: string,
  locale: string = DEFAULT_LOCALE,
): Promise<string> {
  const row = await prisma.localizedLabel.findUnique({
    where: { domain_key_locale: { domain, key, locale } },
  });
  if (row) return row.label;
  if (locale !== DEFAULT_LOCALE) return getLabel(domain, key, DEFAULT_LOCALE);
  return key;
}

export async function upsertLabel(
  domain: LocalizationDomain,
  key: string,
  locale: string,
  label: string,
): Promise<void> {
  await prisma.localizedLabel.upsert({
    where: { domain_key_locale: { domain, key, locale } },
    update: { label },
    create: { domain, key, locale, label },
  });
}

/**
 * The `en` rows equivalent to what used to be hardcoded in `src/app/p/[slug]/page.tsx`
 * and similar components. Idempotent — safe to call from `prisma/seed.ts` repeatedly.
 */
export async function seedDefaultLocalizedLabels(): Promise<void> {
  const defaults: Array<[LocalizationDomain, string, string]> = [
    [LOCALIZATION_DOMAINS.PROFESSIONAL_STAGE, "LEARNING", "Learning"],
    [LOCALIZATION_DOMAINS.PROFESSIONAL_STAGE, "EMERGING", "Emerging"],
    [LOCALIZATION_DOMAINS.PROFESSIONAL_STAGE, "PRACTICING", "Practicing"],
    [LOCALIZATION_DOMAINS.PROFESSIONAL_STAGE, "ESTABLISHED", "Established"],

    [LOCALIZATION_DOMAINS.SKILL_CATEGORY_GROUP, "TRADES", "Trades"],
    [LOCALIZATION_DOMAINS.SKILL_CATEGORY_GROUP, "ARTS", "Arts"],
    [LOCALIZATION_DOMAINS.SKILL_CATEGORY_GROUP, "AGRICULTURE", "Agriculture"],
    [LOCALIZATION_DOMAINS.SKILL_CATEGORY_GROUP, "HEALTHCARE_ADJACENT", "Healthcare-adjacent"],
    [LOCALIZATION_DOMAINS.SKILL_CATEGORY_GROUP, "TECHNOLOGY", "Technology"],
    [LOCALIZATION_DOMAINS.SKILL_CATEGORY_GROUP, "BUSINESS_PROFESSIONAL", "Business & professional"],
    [LOCALIZATION_DOMAINS.SKILL_CATEGORY_GROUP, "OTHER", "Other"],

    [LOCALIZATION_DOMAINS.AVAILABILITY_STATUS, "OPEN_TO_WORK", "Open to work"],
    [LOCALIZATION_DOMAINS.AVAILABILITY_STATUS, "OPEN_TO_COLLAB", "Open to collaborate"],
    [LOCALIZATION_DOMAINS.AVAILABILITY_STATUS, "LIMITED", "Limited availability"],
    [LOCALIZATION_DOMAINS.AVAILABILITY_STATUS, "NOT_AVAILABLE", "Not available"],
  ];

  for (const [domain, key, label] of defaults) {
    await upsertLabel(domain, key, DEFAULT_LOCALE, label);
  }
}
