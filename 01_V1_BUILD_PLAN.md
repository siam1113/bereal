# COMMON — V1 Build Plan for Claude

> Working brand: **COMMON** (provisional; trademark and domain availability not checked). Tagline: **Every skill deserves to be seen.**
> Document status: Build-ready product specification with explicit assumptions. Date: 2026-10-09.

## 1. Product thesis
A people-first professional discovery and relationship network for *every kind of skill*, from carpentry and tailoring to engineering and executive leadership. People show what they do, demonstrate work, discover other people locally/regionally/globally, establish meaningful relationships, and ask for or offer help. Businesses have separate, linked identities and secondary standing.

**V1 outcome:** A polished, end-to-end **working web app** with real persistence, authentication, interactive flows, and credible seed/demo data. Not a static prototype. Responsive on mobile browsers. Native mobile/desktop apps are **not** in V1.

## 2. Product principles / decisions from discovery
1. People first; business pages separate and linked.
2. All skill categories welcome, including informal trades and people without credentials.
3. One primary skill, multiple secondary skills; all searchable. Relevance should override simplistic primary-skill boosting.
4. Skill, experience, competency, and verification are **separate** signals.
5. Professional stage is system-assigned, based on profession-specific practice criteria; not merely years worked. Show criteria and allow appeals.
6. Badges represent specific verified claims, feedback attributes, or achievements; never a blanket claim of quality.
7. Relationships encode **type, intent, activity/evidence, direction, confirmation, visibility, and lifecycle**. Multiple relationships between two entities allowed.
8. One-sided learning declarations are public by default, hideable, and explicitly **self-declared**; never imply mutual mentorship.
9. Unconfirmed work relationships may be shown as self-declared; the named person/business can dispute them.
10. Endorsements and professional feedback require the endorser to declare prior work together. Unconfirmed endorsements remain clearly unverified; no automatic verified badge.
11. Discovery spans local, region/country, and global; exact residential addresses must never be exposed.
12. Show evidence, **not a single inferred trustworthiness score**.

## 3. Users and key journeys
- Skilled professional: joins, chooses carpenter as primary skill, adds furniture finishing, uploads project images, lists services, receives local inquiries.
- Emerging practitioner: joins with projects but no paid experience; stage reflects evidence, not prestige.
- Client/requester: posts 'Need a cabinet repaired', sees relevant people, contacts one, optionally creates a work relationship.
- Learner: declares 'Learning furniture design from X's public work'; profile shows a self-declared learning link, not mutual association.
- Business owner: creates a workshop page, links owner identity, lists services and team (team membership claims need confirmation to be marked confirmed).

## 4. V1 scope (must ship)
### A. Account and identity
- Email/password authentication with email verification, reset password, account deletion; optional social login later.
- Personal profile: display name, bio, general location, languages, availability, primary skill, secondary skills, work samples, experience entries, optional credentials, contact preferences.
- Skill taxonomy with aliases, multilingual-ready labels, free-text suggestion queue; avoid restricting users to formal occupations.
- Portfolio items with images, descriptions, dates, tags, links, and visibility settings.
- Separate business pages: name, description, region, services, owner/admin links, portfolio; owner permission management.

### B. Professional stages and evidence
- Stages: **Learning**, **Emerging**, **Practicing**, **Established** (working names, not superiority rankings).
- System-assigned using configurable profession-category rules and evidence of practice (work samples, documented projects, experience); no claim of objectively measuring skill.
- Show 'self-reported' vs 'verified' independently of stage; users can request review or appeal.
- Claim types: identity, experience, credential, project/work, competency. In V1, support claim submission and admin review with audit history; **do not falsely claim automated verification**.
- Badges: claim verification; collaboration-feedback attributes (communication, reliability, time management); achievements. Badges show basis, issuer, date, status and revocation. Feedback-derived badges require minimum independent confirmed feedback, configurable and abuse-reviewed.

### C. Meaningful relationship graph
- Types: worked with, colleague, collaborator, client/provider, mentor/mentee, consultant/client, business partner, friend, family, learning from.
- Separate **intent** actions: want to collaborate, seek mentorship, seek consultation, interested in hiring, want to learn, socialize.
- States: proposed, active, past, planned; evidence: optional project reference or activity description.
- Confirmation: self-declared, mutually confirmed, evidence-reviewed. Never label self-declared as confirmed.
- Each participant controls visibility on **their own profile**; public claims referencing another person have dispute/report workflows. Sensitive family relationships require additional consent to expose the other party's identity publicly (privacy exception to general self-declaration).
- Multiple simultaneous types per pair. Mutual confirmation cannot be forged by unilateral edits.
- 'Learning from' supports one-sided public declaration, optionally hidden, with explicit wording and no implication of consent.
- Endorse skill / leave professional feedback only after declaring work history; label unconfirmed endorsements as unverified, and prevent them from issuing verified badges.

### D. Discover and match
- Search by people, skills (primary/secondary), professions, services, location, availability, verified claim type, stage.
- Geographic scopes: local (city/district or approximate radius), regional/country, global; privacy-safe approximate locations.
- Explainable match list: skill relevance, geography, availability, portfolio evidence, relevant confirmed work; no opaque trust score.
- Basic intent-based suggestion: user describes need; use deterministic taxonomy matching first, optional LLM extraction with confirmation and fallback. No fabricated profiles or claims.

### E. Social and opportunity layer
- Feed: portfolio updates, short professional posts, comments, reactions, follow for updates (following does **not** imply relationship), report/block.
- Requests/help posts: 'I need help with X'; professionals can express interest; requester can shortlist/contact.
- Opportunities: small tasks, contract gigs, full-time jobs; basic post/apply flow; distinguish types and location/remote.
- Services: offerings attached to personal or business profiles; inquiry flow, not payments/escrow in V1.
- Messaging: one-to-one inbox, permission controls, abuse reporting; basic notifications.

### F. Safety, accessibility, and operations
- Report, block, moderation queue, impersonation/disputed-claim handling, audit log, rate limiting, spam protection.
- No public home address, phone, or exact location by default. Granular profile/portfolio visibility.
- Accessible, low-bandwidth mobile-first UX, keyboard navigation, alt text, understandable plain language; i18n-ready with English and Bangla UI foundations.
- Admin panel for skill taxonomy, verification review, disputes, moderation, stage rules, and analytics.

## 5. UX / pages
Landing, sign-up/login, onboarding, home/feed, discover/search, profile public/edit, portfolio detail/editor, relationship directory/request/confirmation, badge and claim detail, people match results, help request create/detail, opportunities list/detail/apply, services list/detail/inquire, messaging, notifications, business page/manage, settings/privacy, admin dashboard.

**Visual direction:** Distinctive editorial, craft-inclusive identity; warm off-white/charcoal with one confident accent, professional typography, real portfolio imagery, generous whitespace, responsive cards. Avoid corporate-only imagery, fake ratings, and generic AI-dashboard styling. Brand name provisional.

## 6. Architecture recommendation
- **Web:** Next.js App Router + TypeScript + Tailwind + accessible component library.
- **API:** Next.js server actions/route handlers for V1, typed service layer; Zod validation.
- **Data:** PostgreSQL + Prisma (or Drizzle; choose one and document). Use normalized join tables for graph and skill links.
- **Auth:** mature auth provider/library with verified email and secure sessions.
- **Media:** S3-compatible object storage with signed uploads and content checks.
- **Search:** PostgreSQL full-text/trigram initially, explicit ranking logic; later dedicated search engine.
- **Async:** job queue for notifications, image processing, moderation, optional matching enrichment.
- **Observability:** structured logs, error tracking, basic metrics; analytics without leaking private details.
- **Deployment:** Docker-ready, CI checks, database migrations, environment example, documented production deployment.

### Suggested core entities
User, PersonProfile, Business, BusinessMembership, Skill, SkillAlias, PersonSkill(primary flag), PortfolioItem, ExperienceEntry, CredentialClaim, VerificationReview, BadgeDefinition, BadgeAward, Relationship(type/direction/state/confirmation), RelationshipParticipantVisibility, RelationshipEvidence, RelationshipDispute, Endorsement, ProfessionalFeedback, Post, Comment, Reaction, Follow, HelpRequest, HelpResponse, Opportunity, Application, ServiceOffering, Inquiry, Conversation, Message, Notification, Report, AuditEvent.

**Invariant:** No self-declared link can mutate another party's confirmed status or profile visibility. Every verification has provenance, reviewer, timestamp, expiration/revocation if relevant.

## 7. Delivery phases / acceptance criteria
**Phase 0 — Foundation:** repo, design tokens, auth, schema, seed data, CI, basic tests. Exit: a new user can register and log in.

**Phase 1 — Identity:** profiles, skill taxonomy, portfolios, business pages. Exit: a woodworker and a software engineer can build equally expressive public profiles.

**Phase 2 — Relationships & trust:** directed/mutual ties, lifecycle, claims, badges, endorsements, disputes. Exit: one-sided learning and confirmed collaboration render differently and persist correctly.

**Phase 3 — Discovery & opportunities:** scoped search, matching explanations, help requests, jobs, services. Exit: a requester finds and contacts an appropriate provider using a real seeded dataset.

**Phase 4 — Social & messaging:** feed, interactions, inbox, notifications, moderation. Exit: two users can complete a request-to-conversation-to-relationship loop.

**Phase 5 — Hardening:** accessibility, security, privacy, performance, integration/e2e tests, deployment. Exit: no critical auth/privacy flaws; automated end-to-end tests pass.

### Non-negotiable V1 test cases
- A user can have one primary and many secondary skills; secondary skills appear in search.
- Two people can have multiple concurrent relationship types.
- A learning link is self-declared and publicly visible unless its author hides it.
- A work claim remains self-declared until confirmation; the other party can dispute it.
- Unconfirmed work-linked endorsements are shown unverified; they do not grant verified competency badges.
- Profile visibility on one account does not override the other account's settings.
- A client can post help request, see matches, inquire, and message.
- Businesses are separately represented and linked to people.
- Search scopes return distinct local/region/global results without exposing precise location.

## 8. V1 metrics and launch constraints
Measure onboarding completion, % profiles with primary skill and portfolio, first relevant search success, help-request response rate, time to first meaningful interaction, relationship confirmations, dispute rate, moderation turnaround, 7/30-day retention. Track category and geography coverage to avoid a misleading empty-network experience.

**Do not promise scale or revenue in V1.** Launch with one or two dense geographic/skill communities while preserving universal product architecture. V1 excludes payments, escrow, fully automated competence testing, native apps, and unverified AI 'trust scores'.

## 9. Instructions for Claude coding agent
1. Read this file and `02_FIVE_YEAR_VISION.md`; treat explicit decisions as requirements and recommendations as adjustable.
2. Produce `IMPLEMENTATION_PLAN.md` with milestones, database schema, routes, components, tests, and deployment strategy. Note unresolved decisions; choose safe defaults and document assumptions.
3. Implement **working** vertical slices with real database persistence; no mock-only core flows, dead buttons, or fake verification.
4. Add demo seed data spanning trades, arts, agriculture, healthcare-adjacent non-clinical services, and technology, with clearly fictional accounts.
5. Test relationship/verification authorization and privacy invariants before polishing visuals.
6. Run lint, typecheck, unit/integration and Playwright e2e tests; report what passed and what remains.
7. Use environment variables; never commit credentials. Provide README, `.env.example`, migration and local-run instructions.
8. Build accessible responsive web UI, designed to accommodate future mobile/desktop clients via stable domain APIs.

## 10. Open decisions to validate before public launch
- Exact stage criteria for each skill family; review/appeal governance.
- Which claims qualify for human review and how to prevent document exposure.
- Dispute and public-name reference rules in different jurisdictions.
- Minimum feedback count and anti-collusion criteria for attribute badges.
- Whether the first launch community is local trades, creators, or mixed professions.
- Brand clearance, domain, and trademark review.
