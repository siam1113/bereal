# Year 2+ roadmap

> Decomposed from the original `02_FIVE_YEAR_VISION.md` (now removed from the repo) into
> independent workstreams, each sized to hand to its own Claude Code session. V1 (see
> [`../product-overview.md`](../product-overview.md)) is already built and merged; none
> of this is authorized to start until the stage gates below are actually met — this is
> direction, not a current backlog.

## Before touching any track

1. Read [`../product-overview.md`](../product-overview.md),
   [`../architecture.md`](../architecture.md), [`../data-model.md`](../data-model.md),
   and [`../decisions.md`](../decisions.md) first — every track below assumes that
   context and doesn't repeat it.
2. Flag product-policy decisions (verification rules, reputation scoring, moderation
   thresholds, monetization) to the user instead of inventing them. That instruction
   carried over verbatim from the original vision doc's agent-handoff section.
3. Record major technology or schema choices as a new entry in
   [`../decisions.md`](../decisions.md), same format as the existing entries.
4. If more than one track is being worked concurrently, coordinate Prisma schema
   changes — V1 built its five feature verticals this way (see git history: "Vertical
   A" through "Vertical E"), each against the shared schema, merged in sequence. Pull
   the latest `prisma/schema.prisma` before adding a migration; don't let two tracks
   each write a migration against the same table without rebasing.

## Stage gates (unchanged from the original vision)

Don't start any track below until V1 shows real repeat usage and completed help/
collaboration outcomes — not raw signups. Before automated verification: measure false
positive/negative rates against a human-reviewed reference set first. Before any
cross-border or transaction feature: get a read on payments, consumer protection, tax,
and safeguarding obligations first. Before a 10x scale investment of any kind: show
retention, liquidity, unit economics and safety-ops need — don't scale to hit a
headline number.

## North star

Monthly **meaningful outcomes** — help requests resulting in contact/engagement,
mutually confirmed collaborations, completed mentoring sessions, fulfilled
opportunities — with strict event definitions and fraud filtering. Every track below
should be justified by moving this number, not by feature completeness.

## Permanent foundations (apply to every track)

- People first, organizations second; identities portable and user-controlled.
- Inclusive discovery for informal trades, crafts, creative work, knowledge work, and
  emerging skills — never biased toward degrees, elite jobs, or big cities.
- Self-claims, mutual confirmations, and reviewed evidence stay visibly distinct.
- Relationships can be directed, mutual, multiple, contextual, time-bound, disputed.
- Endorsements require declared prior work; unconfirmed ones stay visibly unverified.
- Local/region/global discovery without exposing exact location.
- Competency, experience, credentials, and professional stage stay distinct signals.
- Show evidence and explanations — never collapse signals into one trust score.

## Risk register

| Risk | Countermeasure |
|---|---|
| Cold-start / empty search results | Dense local/category seeding before expanding |
| Fake work claims / endorsement rings | Provenance, disputes, confirmed/unconfirmed separation |
| Harassment / doxxing via public claims | Visibility controls, claim challenges, rapid takedown |
| Bias toward degrees/elite jobs/big cities | Evidence-inclusive taxonomy, localized audits |
| Verification costs grow too fast | Tiered review, partners, expiry, human appeals |
| Feature sprawl | Gate expansion on outcome/retention evidence, not ambition |
| Regulatory / cross-border complexity | Region-by-region rollout, counsel review |
| AI hallucinated skills or reputation | Ground in user-approved evidence; explicit uncertainty |
| Monetization damages trust | Separate sponsored visibility from verified proof |

## Tracks

| # | Track | Primary vision year | One-line scope |
|---|---|---|---|
| 1 | [Search & discovery](./01-search-and-discovery.md) | 2–3 | Real ranking/relevance; later semantic matching with explanations |
| 2 | [Identity & evidence](./02-identity-and-evidence.md) | 2 | Reference checks, claim provenance, attestations, expiry/appeals |
| 3 | [Relationships & collaboration graph](./03-relationships-and-collaboration.md) | 2–3 | Project-based collaboration history, team histories, private networks |
| 4 | [Opportunity network](./04-opportunity-network.md) | 2–3 | Microtasks, apprenticeships, team formation, project sourcing |
| 5 | [Learning & mentorship](./05-learning-and-mentorship.md) | 2–3 | Mentorship marketplace, expert sessions, learning circles |
| 6 | [Business tooling](./06-business-tooling.md) | 2 | Storefronts, workflow integrations, analytics, verified memberships |
| 7 | [Platform, API & native clients](./07-platform-api-and-clients.md) | 2 | API-first service layer, native client groundwork, localization |
| 8 | [AI assistance](./08-ai-assistance.md) | 3 | NL need parsing, explainable suggestions, portfolio/translation help |
| 9 | [Trust, safety & moderation at scale](./09-trust-safety-and-moderation.md) | 2–4 | Abuse/rate control, dispute tooling, scalable review queues |

## Remaining strategic questions (no track below answers these — don't assume otherwise)

- Initial beachhead market/city/categories.
- Strongest repeat-use loop: discover provider, find opportunity, or learn/collaborate?
- What evidence can be verified cost-effectively for informal trades?
- Which regional regulations and minors' protections apply?
- How to distinguish completed work from claimed work at scale.
- How much of the social feed improves professional outcomes vs. distracts from them.
