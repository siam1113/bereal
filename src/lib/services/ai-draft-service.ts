import { callExternalCompletion, isExternalAiProviderEnabled } from "@/lib/ai-provider";

export type DraftSource = "LOCAL_TEMPLATE" | "EXTERNAL_LLM";

export interface DraftResult {
  draftText: string;
  source: DraftSource;
  /** Always render this next to the draft — the whole point of this feature is that
   *  an AI draft is never mistaken for already-saved, verified content. */
  disclaimer: string;
}

const DISCLAIMER =
  "AI-suggested draft — review and edit before saving. Nothing here is saved automatically, and this text carries no verification status of its own.";

/**
 * Assistive drafting for a user's OWN portfolio item / bio text (docs/roadmap/08-ai-
 * assistance.md, "What to build" item 3: "opt-in, user reviews and approves before
 * saving, never auto-posts").
 *
 * These functions only ever RETURN a suggested string — nothing here touches the
 * database. The API routes that call these (src/app/api/ai/portfolio-draft,
 * .../bio-draft) never write the result anywhere; the client has to copy it into the
 * normal edit form and submit through the existing portfolio-service.ts /
 * profile-service.ts update endpoints, exactly like a manually typed edit. That's what
 * makes "review and approve before saving" true by construction rather than by policy.
 *
 * Both the external-LLM system prompts and the local templates are deliberately
 * constrained to only rephrase/expand the literal title/tags/notes/skills given to
 * them — never to invent credentials, dates, clients, or outcomes that weren't
 * supplied, per this track's "no fabricated evidence" invariant.
 */
export interface PortfolioDraftInput {
  title: string;
  tags?: string[];
  rawNotes?: string;
  existingDescription?: string;
}

export async function draftPortfolioDescription(input: PortfolioDraftInput): Promise<DraftResult> {
  if (isExternalAiProviderEnabled()) {
    try {
      const text = await callExternalCompletion({
        system:
          "You help a tradesperson/professional write a short (2-4 sentence) " +
          "portfolio item description for a people-first skills-discovery network that " +
          "welcomes informal trades as much as credentialed professions. Base it ONLY " +
          "on the title, tags, and notes given to you — never invent credentials, " +
          "outcomes, clients, or dates that weren't given. Plain, concrete, first " +
          "person. No markdown, no headings.",
        prompt: JSON.stringify(input),
        maxTokens: 300,
      });
      return { draftText: text.trim(), source: "EXTERNAL_LLM", disclaimer: DISCLAIMER };
    } catch {
      // Fall through to the local template below — never fail the request just because
      // the external provider is unavailable.
    }
  }
  return { draftText: localPortfolioTemplate(input), source: "LOCAL_TEMPLATE", disclaimer: DISCLAIMER };
}

function localPortfolioTemplate(input: PortfolioDraftInput): string {
  const tagsPart = input.tags?.length ? ` Skills involved: ${input.tags.join(", ")}.` : "";
  const notesPart = input.rawNotes?.trim() ? ` ${input.rawNotes.trim()}` : "";
  const base = input.existingDescription?.trim() || `Work on "${input.title}".`;
  return `${base}${tagsPart}${notesPart}`.trim();
}

export interface BioDraftInput {
  displayName: string;
  primarySkillName?: string | null;
  secondarySkillNames?: string[];
  rawNotes?: string;
  existingBio?: string | null;
}

export async function draftBioText(input: BioDraftInput): Promise<DraftResult> {
  if (isExternalAiProviderEnabled()) {
    try {
      const text = await callExternalCompletion({
        system:
          "You help someone write a short (2-3 sentence) professional bio for a " +
          "people-first skills-discovery network that welcomes informal trades as much " +
          "as credentialed professions. Base it ONLY on the name, skills, and notes " +
          "given — never invent credentials, years of experience, or achievements that " +
          "weren't given. Plain, first person, no markdown.",
        prompt: JSON.stringify(input),
        maxTokens: 250,
      });
      return { draftText: text.trim(), source: "EXTERNAL_LLM", disclaimer: DISCLAIMER };
    } catch {
      // fall through
    }
  }
  return { draftText: localBioTemplate(input), source: "LOCAL_TEMPLATE", disclaimer: DISCLAIMER };
}

function localBioTemplate(input: BioDraftInput): string {
  const skills = [input.primarySkillName, ...(input.secondarySkillNames ?? [])].filter(Boolean);
  const skillsPart = skills.length ? ` Working in ${skills.join(", ")}.` : "";
  const notesPart = input.rawNotes?.trim() ? ` ${input.rawNotes.trim()}` : "";
  const base = input.existingBio?.trim() || `${input.displayName}.`;
  return `${base}${skillsPart}${notesPart}`.trim();
}
