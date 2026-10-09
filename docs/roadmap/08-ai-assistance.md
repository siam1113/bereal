# Track 8 — AI assistance

## Scope

Natural-language need parsing into structured skill/constraint search (feeding Track
1's search), explainable candidate suggestions, portfolio-writing help, translation
assistance, and fraud-detection *assistance* (flagging for human review, not auto-
action). Consent-aware matching.

## Why

Product-expansion "AI assistance" track — and its own explicit guardrail: "Keep AI
recommendations distinguishable from verified facts." This is later-year scope
("semantic matching with explanations") and depends on Track 1 landing first.

## What exists today

Nothing — no AI/LLM integration exists in the codebase today. Track 1's ranked search
is the foundation this track sits on top of; don't start this track before Track 1's
relevance signals exist — there's nothing to make "explainable suggestions" out of
otherwise.

## What to build

1. NL → structured query: parse a free-text need ("need someone to fix a cabinet
   locally this week") into the existing structured search params (`skillId`,
   `geoScope`, `availability`, etc.) — a parsing/mapping layer in front of Track 1's
   search, not a new ranking mechanism.
2. Explainable suggestions: generate a human-readable explanation *grounded in* the
   same `matchReasons` data Track 1 already computes — never a free-floating LLM claim
   about a candidate's quality that isn't backed by stored evidence.
3. Portfolio-writing help: an assistive drafting tool for a user's own portfolio
   item/bio text — opt-in, user reviews and approves before saving, never auto-posts.
4. Translation assistance: machine translation of user-generated text for display,
   clearly labeled as translated, original preserved.
5. Fraud-detection assistance: flags suspicious claims/relationships/feedback patterns
   into the existing moderation queue (Track 9) for human review — never auto-rejects
   or auto-confirms anything.

## Invariants to preserve (these are the whole point of this track)

- AI output must always be visually and structurally distinguishable from verified,
  user-submitted, or admin-reviewed facts — never silently blended in.
- No AI-generated "trust score" or quality judgment about a person — explicitly ruled
  out, same as the non-AI version of this rule.
- Every suggestion must be traceable back to real stored evidence (profile data,
  portfolio, confirmed relationships) — no fabricated or hallucinated skills/claims.

## Policy questions to flag, not decide silently

- Which model/provider, data retention for anything sent to it, and whether user
  content (bios, portfolio text, messages) can be sent to a third-party API at all —
  get explicit sign-off before wiring any user data into an external LLM call.
