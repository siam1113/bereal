# Product overview

**Proverse** — *Every skill deserves to be seen.* (Working name; trademark/domain not cleared.)

A people-first professional discovery and relationship network for *every kind of
skill* — carpentry and tailoring as much as engineering and executive leadership. People
show what they do, demonstrate work, discover other people locally/regionally/globally,
establish meaningful relationships, and ask for or offer help. Businesses have separate,
linked identities with secondary standing to people.

V1 is a polished, end-to-end working web app with real persistence, authentication,
interactive flows, and credible seed data — not a static prototype. Responsive on mobile
browsers; native mobile/desktop apps are out of scope for V1.

## Product principles

These are requirements, not suggestions — they shaped the data model and the service
layer, not just the UI:

1. People first; business pages are separate and linked to the people behind them.
2. Every skill category is welcome, including informal trades and people without formal
   credentials.
3. One primary skill, multiple secondary skills, all searchable. Relevance ranking
   doesn't just boost the primary skill.
4. Skill, experience, competency, and verification are **separate** signals — never
   collapsed into one.
5. Professional stage is system-assigned from profession-specific practice criteria, not
   just years worked. Criteria are visible; appeals are possible.
6. Badges represent a specific verified claim, feedback attribute, or achievement —
   never a blanket claim of quality.
7. Relationships encode type, intent, evidence, direction, confirmation, visibility, and
   lifecycle. Multiple relationship types between the same two people are expected.
8. One-sided learning declarations are public by default, hideable by their author, and
   explicitly self-declared — never implying the other party agreed.
9. Unconfirmed work relationships can still be shown as self-declared; the named
   counterpart can dispute them.
10. Endorsements and professional feedback require the endorser to have declared prior
    work together. Unconfirmed endorsements stay visibly unverified and never grant a
    verified badge.
11. Discovery spans local, region/country, and global scopes; exact residential
    addresses are never exposed.
12. Show evidence — never a single inferred trustworthiness score.

## Key user journeys

- **Skilled professional** — joins, picks carpenter as a primary skill, adds furniture
  finishing as secondary, uploads project images, lists a service, gets local inquiries.
- **Emerging practitioner** — joins with projects but no paid experience; their stage
  reflects actual evidence, not prestige.
- **Client/requester** — posts "Need a cabinet repaired," sees relevant people, contacts
  one, optionally forms a declared work relationship afterward.
- **Learner** — declares "Learning furniture design from X's public work"; this shows as
  a one-sided, self-declared link, never implying X agreed to mentor them.
- **Business owner** — creates a workshop page, links their own identity as owner, lists
  services and team; a claimed team membership needs the owner's confirmation to show as
  confirmed rather than self-declared.

## V1 scope

### Account and identity
Email/password auth with email verification, password reset, account deletion. Personal
profiles (display name, bio, general location, languages, availability, primary +
secondary skills, work samples, experience, contact preferences). A skill taxonomy with
aliases and a free-text suggestion queue so nobody is boxed into a fixed occupation list.
Portfolio items with images, tags, dates, links, and per-item visibility. Separate
business pages with owner/admin links and membership confirmation.

### Professional stages and evidence
Four stages — **Learning, Emerging, Practicing, Established** — working names, not a
superiority ranking, system-assigned from profession-category rules and evidence of
practice. Self-reported vs. verified is tracked independently of stage. Claim types:
identity, experience, credential, project/work, competency — submitted by the user,
reviewed by an admin with full audit history. Badges for claim verification,
feedback-derived attributes (communication, reliability, time management), and
achievements, each showing basis/issuer/date/status/revocation.

### The relationship graph
Types: worked-with, colleague, collaborator, client/provider, mentor/mentee,
consultant/client, business partner, friend, family, learning-from. A separate *intent*
layer on the request that creates a relationship: want to collaborate, seek mentorship,
seek consultation, interested in hiring, want to learn, socialize. States: proposed,
active, past, planned. Confirmation: self-declared → mutually confirmed (or
evidence-reviewed) — never auto-promoted, never forgeable by a unilateral edit. Each
participant controls visibility on their own side only. Family relationships need the
named counterpart's explicit consent before their identity shows publicly attached to
the claim. Endorsing a skill or leaving feedback requires a declared relationship first;
unconfirmed ones stay visibly unverified and can't mint a verified badge.

### Discover and match
Search by people, skill (primary or secondary), profession, service, location,
availability, verified claim type, stage. Geographic scopes — local, region/country,
global — without ever exposing a precise address. Results carry an explainable match
breakdown (skill relevance, geography, availability, portfolio evidence) instead of one
opaque trust score.

### Social and opportunity layer
A feed (portfolio updates, short posts, comments, reactions, follows — following never
implies a relationship), report/block. Help requests ("I need help with X") with
responses and shortlisting. Opportunities (tasks, contract gigs, full-time) with
apply/status flows. Services attached to a person or business, with an inquiry flow —
no payments or escrow in V1. One-to-one messaging with notifications.

### Safety, accessibility, operations
Report/block, a moderation queue, dispute handling, an audit log, rate limiting. No
public home address, phone, or exact location by default; granular visibility controls.
Accessible, mobile-first, keyboard-navigable UI. An admin panel for skill taxonomy,
verification review, disputes, moderation, stage rules, and analytics.

## Non-negotiable V1 test cases

These are the acceptance bar — see [testing.md](./testing.md) for what's actually
verified today versus what's a documented gap:

- A user can have one primary and many secondary skills; secondary skills appear in
  search.
- Two people can have multiple concurrent relationship types.
- A learning link is self-declared and publicly visible unless its author hides it.
- A work claim remains self-declared until confirmation; the other party can dispute it.
- Unconfirmed work-linked endorsements show as unverified and never grant a verified
  competency badge.
- Profile visibility on one account never overrides the other account's own settings.
- A client can post a help request, see matches, inquire, and message.
- Businesses are separately represented and linked to people.
- Search scopes return distinct local/region/global results without exposing precise
  location.

## Explicitly out of scope for V1

Payments and escrow, fully automated competence testing, native mobile/desktop apps,
and any unverified AI "trust score." V1 is meant to launch in one or two dense
geographic/skill communities, not promise scale — see [decisions.md](./decisions.md)
for the open questions that should be resolved before a public launch.
