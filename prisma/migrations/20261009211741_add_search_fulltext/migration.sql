-- Track 1 (search & discovery): real ranking for people/skill search, replacing
-- ILIKE/array-overlap + `updatedAt desc` ordering (see docs/decisions.md).
--
-- pg_trgm powers both the trigram similarity ranking/typo tolerance on
-- displayName/bio/Skill.name/SkillAlias.alias AND the GIN indexes below (the
-- `gin_trgm_ops` operator class requires the extension to exist first).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
-- Generated, stored tsvector combining displayName (weight A, matches stronger) and
-- bio (weight B) for word-level full-text ranking (ts_rank/websearch_to_tsquery).
-- Postgres maintains this automatically on insert/update — never written to from
-- application code, and Prisma has no native tsvector type hence `Unsupported` in
-- schema.prisma.
ALTER TABLE "PersonProfile"
  ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("displayName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("bio", '')), 'B')
  ) STORED;

-- CreateIndex
CREATE INDEX "PersonProfile_searchVector_idx" ON "PersonProfile" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "PersonProfile_displayName_idx" ON "PersonProfile" USING GIN ("displayName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "PersonProfile_bio_idx" ON "PersonProfile" USING GIN ("bio" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Skill_name_idx" ON "Skill" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "SkillAlias_alias_idx" ON "SkillAlias" USING GIN ("alias" gin_trgm_ops);
