# Localization

Groundwork only, per the Track 7 roadmap scope: V1 ships `en` rows equivalent to what
used to be hardcoded, not translation coverage for any other locale and not a full
multilingual UI rollout (that's named explicitly as later-year scope).

## What exists

- **`SkillAlias.locale`** (pre-existing) — skill name aliases already carried a
  `locale` column, default `"en"`. The pattern this track generalizes.
- **`LocalizedLabel`** (`prisma/schema.prisma`) — a single table for enum-backed display
  labels that previously lived as hardcoded `Record<string, string>` maps in page
  components (professional stage names, skill category group names, availability
  status). One row per `(domain, key, locale)`; `domain` is a free-text key matching a
  Prisma enum name by convention (e.g. `"PROFESSIONAL_STAGE"`), not DB-enforced.
- **`src/lib/services/localization-service.ts`** — `getLabel()`/`getLabels()` read with
  fallback to `en`, then to the raw enum key, so a missing row (a new enum value seeded
  before its label is) never breaks a page. `upsertLabel()` writes one row.
  `seedDefaultLocalizedLabels()` is the idempotent set of `en` defaults, called from
  `prisma/seed.ts`.
- **`src/app/p/[slug]/page.tsx`** — the end-to-end demonstration of the pattern: stage
  and availability labels are fetched via `getLabels()` instead of the hardcoded maps
  that used to live in this file. This is the reference for converting any other
  hardcoded label map elsewhere in the app the same way.

## What's deliberately not done

- Other pages with their own hardcoded label maps (if any) were not swept and converted
  — `/p/[slug]/page.tsx` is the one demonstrated conversion, not a completed migration.
  Convert the rest opportunistically, same pattern.
- **`next-intl`** was added as a dependency (`package.json`) as the chosen library for
  future full UI-string translation (ordinary JSX text, not DB-backed enum values) —
  this is the "decide on an i18n library" deliverable from the Track 7 roadmap doc. It
  is **not wired into any route, layout, or component yet**: no `next.config.ts` plugin,
  no message catalog, no provider. Actually translating UI strings is out of this
  track's scope ("plumbing only"); wiring `next-intl` without a translation to ship
  would be exactly the "feature sprawl" risk the roadmap doc warns against. Treat the
  dependency as a recorded decision, not a half-finished integration.

## Why a DB table instead of a JSON message catalog for these specific labels

Stage names, category groups, and availability statuses are Prisma enum values tied to
app logic (filters, badges, seed data) — a DB table keeps them next to the rows that
reference them and lets an admin change a label without a deploy. Free-text UI copy
(buttons, headings, help text) is a different problem with a different right answer
(`next-intl` message catalogs); this table was never meant to hold that.
