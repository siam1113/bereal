# Track 1 — Search & discovery

## Scope

Replace the current `ILIKE`-only search with real relevance ranking (Postgres
full-text + trigram first; defer a dedicated search engine until query latency or
result quality actually demands it — see "Out of scope" below). Year 3's "semantic
matching with explanations" builds on this but is not in scope here; land ranked
keyword search first.

## Why

`docs/decisions.md` already flags this as the thing to revisit: *"Search is
ILIKE/array-overlap, not trigram or a dedicated engine... revisit if result quality or
query latency demands it."* `product-overview.md`'s non-negotiable test list and the
roadmap's north-star metrics both treat "first relevant search success" as a named
health metric — it currently has no ranking signal at all (results order by
`updatedAt desc`).

## What exists today (read before changing anything)

- `src/lib/services/search-service.ts` — the only place search queries live.
  - `searchPeople()`: `contains`/`mode: insensitive` on `displayName`/`bio`; nested
    `personSkills.some.skill` match for skill name/alias; exact `skillId`/`stage`
    filters; a separate pre-query geo lookup (`nearProfileId` → exact `city`/`region`/
    `country` equality for `LOCAL`/`REGION`; `GLOBAL` applies no geo filter). Computes
    `matchReasons` (skillMatch, geoMatch, hasPortfolio, availability) in app code —
    deliberately no blended score (see comment citing "plan section 2.12" — preserve
    that principle, see Invariants below).
  - `searchSkillsForPicker()`: same `contains` pattern against `Skill.name`/
    `SkillAlias.alias`, filtered to `isApproved: true`.
- Routes: `GET /api/search/people` (`src/app/api/search/people/route.ts`) and
  `GET /api/search/skills` (`src/app/api/search/skills/route.ts`). Neither exposes
  pagination today — `searchPeople` hardcodes `limit: 30`.
- UI: `src/app/discover/page.tsx` (expects `{ results: SearchPersonResult[] }` with the
  exact `matchReasons` shape) and `src/components/discover/skill-picker.tsx` (expects
  `{ skills: {id, name}[] }`, 200ms debounce). Keep both response shapes stable, or
  update both call sites in the same change.
- Relevant schema (`prisma/schema.prisma`): `PersonProfile` (`displayName`, `bio`,
  `city`/`region`/`country`, coarsened `approxLat`/`approxLng`), `Skill`/`SkillAlias`
  (`isApproved`, `locale`), `PersonSkill` (`isPrimary`, `stage`), `PortfolioItem`
  (`visibility` — **currently not filtered in search at all**; decide whether to gate
  on it as part of this track and flag that as a fix either way).
- `@prisma/client`/`prisma` pinned to `6.19.3` (see `docs/decisions.md` for why — stay
  on this unless there's a strong reason to revisit the pin here too).

## What to build

1. A Postgres migration adding `pg_trgm` and either a generated `tsvector` column or
   trigram GIN indexes on the searchable text fields (`PersonProfile.displayName`/
   `bio`, `Skill.name`, `SkillAlias.alias`). Prisma 6 has no native `tsvector` field
   type — express it with `Unsupported("tsvector")` in `schema.prisma` plus raw SQL in
   the migration (`prisma/migrations/<timestamp>_add_search_fulltext/migration.sql`),
   matching the existing single-migration naming convention.
2. Rank results with `ts_rank`/trigram similarity instead of `updatedAt desc`, blended
   with (not replacing) the existing `matchReasons` breakdown — the explainability
   principle (no single opaque score) is a product invariant, not a performance detail.
3. Add real pagination (`limit`/`cursor` or `offset`) to `GET /api/search/people`,
   wired through to `discover/page.tsx`.
4. Decide and implement `PortfolioItem.visibility` filtering in search results — flag
   this decision explicitly in a `docs/decisions.md` entry regardless of which way it's
   resolved, since it changes who shows up in results.

## Invariants to preserve

- No single blended "trust"/relevance score replacing the explainable breakdown —
  relevance ranking can reorder results, but `matchReasons` must stay visible per
  result.
- Secondary skills remain fully searchable, not just primary (test case already in
  `product-overview.md`).
- Exact location never leaks — ranking must only ever use the existing coarsened
  `city`/`region`/`country`/`approxLat`/`approxLng`, never add new precise-location
  storage to improve ranking.

## Policy questions to flag, not decide silently

- Should unapproved/pending skills (`Skill.isApproved: false`) ever surface in search,
  even ranked lower? (Today they're excluded from the picker only.)
- Should `PortfolioItem.visibility` gate search inclusion (see above)?

## Out of scope here

Semantic/embedding-based matching (Year 3), and migrating to a dedicated search engine
(Meilisearch/Typesense/Elasticsearch) — don't reach for either until this track's
ranked-keyword version is live and measured latency/quality actually demands more;
bringing in a separate search service now would contradict the roadmap's own
stage-gating ("avoid premature microservices... instrument, then evolve").
