import { PrismaClient, type Prisma, type SkillCategoryGroup } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDefaultLocalizedLabels } from "../src/lib/services/localization-service";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Passw0rd!2026";

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

const SKILLS: { slug: string; name: string; group: SkillCategoryGroup }[] = [
  { slug: "carpentry", name: "Carpentry", group: "TRADES" },
  { slug: "furniture-finishing", name: "Furniture finishing", group: "TRADES" },
  { slug: "residential-electrical", name: "Residential electrical work", group: "TRADES" },
  { slug: "tailoring", name: "Tailoring", group: "TRADES" },
  { slug: "textile-pattern-design", name: "Textile pattern design", group: "ARTS" },
  { slug: "oil-painting", name: "Oil painting", group: "ARTS" },
  { slug: "graphic-design", name: "Graphic design", group: "ARTS" },
  { slug: "crop-agronomy", name: "Crop agronomy", group: "AGRICULTURE" },
  { slug: "organic-farming", name: "Organic farming", group: "AGRICULTURE" },
  { slug: "livestock-management", name: "Livestock management", group: "AGRICULTURE" },
  { slug: "wellness-coaching", name: "Wellness coaching", group: "HEALTHCARE_ADJACENT" },
  { slug: "elder-care-support", name: "Elder care support", group: "HEALTHCARE_ADJACENT" },
  { slug: "backend-engineering", name: "Backend engineering", group: "TECHNOLOGY" },
  { slug: "frontend-engineering", name: "Frontend engineering", group: "TECHNOLOGY" },
  { slug: "data-analysis", name: "Data analysis", group: "TECHNOLOGY" },
  { slug: "small-business-consulting", name: "Small business consulting", group: "BUSINESS_PROFESSIONAL" },
];

async function seedSkills() {
  const bySlug = new Map<string, string>();
  for (const s of SKILLS) {
    const skill = await prisma.skill.upsert({
      where: { slug: s.slug },
      update: {},
      create: { slug: s.slug, name: s.name, categoryGroup: s.group },
    });
    bySlug.set(s.slug, skill.id);
  }
  return bySlug;
}

interface PersonSeed {
  email: string;
  name: string;
  slug: string;
  bio: string;
  city: string;
  region: string;
  country: string;
  approxLat: number;
  approxLng: number;
  primarySkill: string;
  secondarySkills: string[];
  stage: "LEARNING" | "EMERGING" | "PRACTICING" | "ESTABLISHED";
  availability: "OPEN_TO_WORK" | "OPEN_TO_COLLAB" | "LIMITED" | "NOT_AVAILABLE";
}

const PEOPLE: PersonSeed[] = [
  {
    email: "rashid.carpenter@demo.common.app",
    name: "Rashid Islam",
    slug: "rashid-islam",
    bio: "Furniture maker and carpenter, 14 years building custom cabinetry and restoring antique furniture.",
    city: "Dhaka",
    region: "Dhaka Division",
    country: "Bangladesh",
    approxLat: 23.78,
    approxLng: 90.41,
    primarySkill: "carpentry",
    secondarySkills: ["furniture-finishing"],
    stage: "ESTABLISHED",
    availability: "OPEN_TO_WORK",
  },
  {
    email: "amina.tailor@demo.common.app",
    name: "Amina Chowdhury",
    slug: "amina-chowdhury",
    bio: "Tailor specializing in bridal wear, moving into pattern design for a small label.",
    city: "Dhaka",
    region: "Dhaka Division",
    country: "Bangladesh",
    approxLat: 23.75,
    approxLng: 90.39,
    primarySkill: "tailoring",
    secondarySkills: ["textile-pattern-design"],
    stage: "PRACTICING",
    availability: "OPEN_TO_COLLAB",
  },
  {
    email: "hasan.electrician@demo.common.app",
    name: "Hasan Mahmud",
    slug: "hasan-mahmud",
    bio: "Residential electrician, three years in, training toward a master license.",
    city: "Chattogram",
    region: "Chattogram Division",
    country: "Bangladesh",
    approxLat: 22.36,
    approxLng: 91.8,
    primarySkill: "residential-electrical",
    secondarySkills: [],
    stage: "EMERGING",
    availability: "OPEN_TO_WORK",
  },
  {
    email: "farida.farmer@demo.common.app",
    name: "Farida Begum",
    slug: "farida-begum",
    bio: "Runs a 12-acre organic rice and vegetable farm, consults on crop rotation for smallholders.",
    city: "Rangpur",
    region: "Rangpur Division",
    country: "Bangladesh",
    approxLat: 25.74,
    approxLng: 89.25,
    primarySkill: "organic-farming",
    secondarySkills: ["crop-agronomy"],
    stage: "ESTABLISHED",
    availability: "OPEN_TO_COLLAB",
  },
  {
    email: "kamal.agronomist@demo.common.app",
    name: "Kamal Hossain",
    slug: "kamal-hossain",
    bio: "Agronomy consultant working with cooperatives on soil health and yield improvement.",
    city: "Rangpur",
    region: "Rangpur Division",
    country: "Bangladesh",
    approxLat: 25.75,
    approxLng: 89.24,
    primarySkill: "crop-agronomy",
    secondarySkills: ["livestock-management"],
    stage: "PRACTICING",
    availability: "LIMITED",
  },
  {
    email: "nusrat.wellness@demo.common.app",
    name: "Nusrat Jahan",
    slug: "nusrat-jahan",
    bio: "Wellness coach supporting families with elder care routines and non-clinical home support.",
    city: "Sylhet",
    region: "Sylhet Division",
    country: "Bangladesh",
    approxLat: 24.89,
    approxLng: 91.87,
    primarySkill: "wellness-coaching",
    secondarySkills: ["elder-care-support"],
    stage: "EMERGING",
    availability: "OPEN_TO_WORK",
  },
  {
    email: "tariq.painter@demo.common.app",
    name: "Tariq Rahman",
    slug: "tariq-rahman",
    bio: "Self-taught oil painter, two years in, exhibiting at local community shows.",
    city: "Khulna",
    region: "Khulna Division",
    country: "Bangladesh",
    approxLat: 22.82,
    approxLng: 89.56,
    primarySkill: "oil-painting",
    secondarySkills: [],
    stage: "LEARNING",
    availability: "OPEN_TO_COLLAB",
  },
  {
    email: "sadia.engineer@demo.common.app",
    name: "Sadia Islam",
    slug: "sadia-islam",
    bio: "Backend engineer, 9 years, now also designing systems training for new developers.",
    city: "Dhaka",
    region: "Dhaka Division",
    country: "Bangladesh",
    approxLat: 23.8,
    approxLng: 90.42,
    primarySkill: "backend-engineering",
    secondarySkills: ["data-analysis"],
    stage: "ESTABLISHED",
    availability: "OPEN_TO_COLLAB",
  },
  {
    email: "imran.frontend@demo.common.app",
    name: "Imran Kabir",
    slug: "imran-kabir",
    bio: "Frontend engineer and part-time graphic designer for small business clients.",
    city: "Dhaka",
    region: "Dhaka Division",
    country: "Bangladesh",
    approxLat: 23.77,
    approxLng: 90.4,
    primarySkill: "frontend-engineering",
    secondarySkills: ["graphic-design"],
    stage: "PRACTICING",
    availability: "OPEN_TO_WORK",
  },
  {
    email: "mitu.consultant@demo.common.app",
    name: "Mitu Akter",
    slug: "mitu-akter",
    bio: "Small business consultant helping craftspeople and farmers formalize and grow.",
    city: "Dhaka",
    region: "Dhaka Division",
    country: "Bangladesh",
    approxLat: 23.74,
    approxLng: 90.38,
    primarySkill: "small-business-consulting",
    secondarySkills: [],
    stage: "PRACTICING",
    availability: "OPEN_TO_COLLAB",
  },
];

async function seedPeople(skillIds: Map<string, string>) {
  const bySlug = new Map<string, { userId: string; profileId: string }>();

  for (const p of PEOPLE) {
    const passwordHash = await hash(DEMO_PASSWORD);
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        name: p.name,
        passwordHash,
        emailVerified: new Date(),
        status: "ACTIVE",
        personProfile: {
          create: {
            slug: p.slug,
            displayName: p.name,
            bio: p.bio,
            city: p.city,
            region: p.region,
            country: p.country,
            approxLat: p.approxLat,
            approxLng: p.approxLng,
            languages: ["en", "bn"],
            availability: p.availability,
          },
        },
      },
      include: { personProfile: true },
    });

    const profileId = user.personProfile!.id;
    bySlug.set(p.slug, { userId: user.id, profileId });

    const primaryId = skillIds.get(p.primarySkill)!;
    await prisma.personSkill.upsert({
      where: { personProfileId_skillId: { personProfileId: profileId, skillId: primaryId } },
      update: {},
      create: {
        personProfileId: profileId,
        skillId: primaryId,
        isPrimary: true,
        stage: p.stage,
        stageUpdatedAt: new Date(),
        stageRationale: { note: "Seeded demo rationale based on years practicing and portfolio evidence." },
      },
    });

    for (const sec of p.secondarySkills) {
      const secId = skillIds.get(sec)!;
      await prisma.personSkill.upsert({
        where: { personProfileId_skillId: { personProfileId: profileId, skillId: secId } },
        update: {},
        create: {
          personProfileId: profileId,
          skillId: secId,
          isPrimary: false,
          stage: p.stage === "ESTABLISHED" ? "PRACTICING" : "EMERGING",
        },
      });
    }

    const portfolioTitle = `${p.name.split(" ")[0]}'s recent work`;
    const existingPortfolioItem = await prisma.portfolioItem.findFirst({
      where: { personProfileId: profileId, title: portfolioTitle },
    });
    if (!existingPortfolioItem) {
      await prisma.portfolioItem.create({
        data: {
          personProfileId: profileId,
          title: portfolioTitle,
          description: `A representative project showcasing ${p.primarySkill.replace(/-/g, " ")}.`,
          images: [],
          tags: [p.primarySkill],
          visibility: "PUBLIC",
          dateOccurred: new Date(),
        },
      });
    }
  }

  return bySlug;
}

async function seedAdmin() {
  const passwordHash = await hash(DEMO_PASSWORD);
  await prisma.user.upsert({
    where: { email: "admin@demo.common.app" },
    update: {},
    create: {
      email: "admin@demo.common.app",
      name: "COMMON Admin",
      passwordHash,
      emailVerified: new Date(),
      status: "ACTIVE",
      role: "ADMIN",
      personProfile: {
        create: {
          slug: "common-admin",
          displayName: "COMMON Admin",
          bio: "Platform administration account.",
          languages: ["en"],
        },
      },
    },
  });
}

async function seedBusiness(people: Map<string, { userId: string; profileId: string }>) {
  const rashid = people.get("rashid-islam")!;
  const business = await prisma.business.upsert({
    where: { slug: "rashid-woodworks" },
    update: {},
    create: {
      slug: "rashid-woodworks",
      name: "Rashid Woodworks",
      description: "Custom furniture and cabinetry workshop in Dhaka.",
      city: "Dhaka",
      region: "Dhaka Division",
      country: "Bangladesh",
      approxLat: 23.78,
      approxLng: 90.41,
      ownerUserId: rashid.userId,
    },
  });

  await prisma.businessMembership.upsert({
    where: { businessId_userId: { businessId: business.id, userId: rashid.userId } },
    update: {},
    create: {
      businessId: business.id,
      userId: rashid.userId,
      role: "OWNER",
      status: "CONFIRMED",
      confirmedAt: new Date(),
    },
  });

  return business;
}

async function seedRelationships(people: Map<string, { userId: string; profileId: string }>) {
  const rashid = people.get("rashid-islam")!;
  const amina = people.get("amina-chowdhury")!;
  const hasan = people.get("hasan-mahmud")!;
  const tariq = people.get("tariq-rahman")!;
  const farida = people.get("farida-begum")!;
  const kamal = people.get("kamal-hossain")!;

  async function findOrCreateRelationship(data: Prisma.RelationshipUncheckedCreateInput) {
    const existing = await prisma.relationship.findFirst({
      where: { type: data.type, partyAUserId: data.partyAUserId, partyBUserId: data.partyBUserId },
    });
    if (existing) return { relationship: existing, created: false };
    const relationship = await prisma.relationship.create({ data });
    return { relationship, created: true };
  }

  // Mutually confirmed WORKED_WITH between Rashid and Hasan (rewired a workshop together).
  const { relationship: workedWith, created: workedWithCreated } = await findOrCreateRelationship({
    type: "WORKED_WITH",
    partyAUserId: rashid.userId,
    partyARole: "WORKED_WITH",
    partyBUserId: hasan.userId,
    partyBRole: "WORKED_WITH",
    state: "PAST",
    confirmationStatus: "MUTUALLY_CONFIRMED",
    declaredByUserId: rashid.userId,
  });
  if (workedWithCreated) {
    await prisma.relationshipParticipantVisibility.createMany({
      data: [
        { relationshipId: workedWith.id, userId: rashid.userId, visibility: "PUBLIC" },
        { relationshipId: workedWith.id, userId: hasan.userId, visibility: "PUBLIC" },
      ],
    });
    await prisma.relationshipEvidence.create({
      data: {
        relationshipId: workedWith.id,
        description: "Rewired and rebuilt cabinetry for a client's kitchen renovation together.",
        addedByUserId: rashid.userId,
      },
    });
  }

  // Self-declared LEARNING_FROM: Tariq learning from an established painter persona (use Amina as stand-in mentor for cross-craft inspiration demo).
  const { relationship: learningFrom, created: learningFromCreated } = await findOrCreateRelationship({
    type: "LEARNING_FROM",
    partyAUserId: tariq.userId,
    partyARole: "LEARNER",
    partyBUserId: amina.userId,
    partyBRole: "SUBJECT",
    state: "ACTIVE",
    confirmationStatus: "SELF_DECLARED",
    declaredByUserId: tariq.userId,
  });
  if (learningFromCreated) {
    await prisma.relationshipParticipantVisibility.createMany({
      data: [
        { relationshipId: learningFrom.id, userId: tariq.userId, visibility: "PUBLIC" },
        { relationshipId: learningFrom.id, userId: amina.userId, visibility: "PUBLIC", hidden: false },
      ],
    });
  }

  // Disputed consultant/client relationship between Kamal and Farida.
  const { relationship: disputed, created: disputedCreated } = await findOrCreateRelationship({
    type: "CONSULTANT_CLIENT",
    partyAUserId: kamal.userId,
    partyARole: "CONSULTANT",
    partyBUserId: farida.userId,
    partyBRole: "CLIENT",
    state: "PAST",
    confirmationStatus: "SELF_DECLARED",
    declaredByUserId: kamal.userId,
  });
  if (disputedCreated) {
    await prisma.relationshipParticipantVisibility.createMany({
      data: [
        { relationshipId: disputed.id, userId: kamal.userId, visibility: "PUBLIC" },
        { relationshipId: disputed.id, userId: farida.userId, visibility: "PUBLIC" },
      ],
    });
    await prisma.relationshipDispute.create({
      data: {
        relationshipId: disputed.id,
        raisedByUserId: farida.userId,
        reason: "We only had one brief phone consultation, not an ongoing engagement as implied.",
        status: "OPEN",
      },
    });
  }

  // Unverified endorsement riding on the self-declared learning relationship (should NOT grant a verified badge).
  const textilePatternSkill = await prisma.skill.findUniqueOrThrow({ where: { slug: "textile-pattern-design" } });
  await prisma.endorsement.upsert({
    where: {
      endorserUserId_subjectUserId_skillId: {
        endorserUserId: tariq.userId,
        subjectUserId: amina.userId,
        skillId: textilePatternSkill.id,
      },
    },
    update: {},
    create: {
      endorserUserId: tariq.userId,
      subjectUserId: amina.userId,
      skillId: textilePatternSkill.id,
      relationshipId: learningFrom.id,
      status: "UNVERIFIED",
      comment: "Amina's pattern work taught me a lot about composition even outside textiles.",
    },
  });

  // Confirmed feedback riding on the mutually confirmed WORKED_WITH relationship.
  const existingFeedback = await prisma.professionalFeedback.findFirst({
    where: { authorUserId: hasan.userId, subjectUserId: rashid.userId, relationshipId: workedWith.id },
  });
  if (!existingFeedback) {
    await prisma.professionalFeedback.create({
      data: {
        authorUserId: hasan.userId,
        subjectUserId: rashid.userId,
        relationshipId: workedWith.id,
        attributes: { communication: 5, reliability: 5, timeManagement: 4 },
        comment: "Rashid was clear about scope and always on time.",
        isIndependentlyConfirmed: true,
      },
    });
  }
}

async function seedBadges() {
  await prisma.badgeDefinition.upsert({
    where: { slug: "reliable-collaborator" },
    update: {},
    create: {
      slug: "reliable-collaborator",
      name: "Reliable collaborator",
      description: "Awarded after multiple independent confirmed-relationship feedback entries rating reliability highly.",
      kind: "FEEDBACK_ATTRIBUTE",
      criteria: { minConfirmedFeedback: 3, attribute: "reliability", minScore: 4 },
    },
  });
  await prisma.badgeDefinition.upsert({
    where: { slug: "identity-verified" },
    update: {},
    create: {
      slug: "identity-verified",
      name: "Identity verified",
      description: "An admin reviewed and approved an identity claim.",
      kind: "CLAIM_VERIFICATION",
      criteria: { claimType: "IDENTITY" },
    },
  });
}

async function seedOpportunityLayer(people: Map<string, { userId: string; profileId: string }>, business: { id: string }) {
  const mitu = people.get("mitu-akter")!;
  const rashid = people.get("rashid-islam")!;
  const carpentrySkill = await prisma.skill.findUniqueOrThrow({ where: { slug: "carpentry" } });

  const helpRequestTitle = "Need a custom bookshelf built";
  const existingHelpRequest = await prisma.helpRequest.findFirst({
    where: { authorUserId: mitu.userId, title: helpRequestTitle },
  });
  if (!existingHelpRequest) {
    await prisma.helpRequest.create({
      data: {
        authorUserId: mitu.userId,
        title: helpRequestTitle,
        description: "Looking for a carpenter in Dhaka to build a floor-to-ceiling bookshelf, budget flexible.",
        skillId: carpentrySkill.id,
        geoScope: "LOCAL",
        status: "OPEN",
      },
    });
  }

  const opportunityTitle = "Workshop assistant needed for 3 months";
  const existingOpportunity = await prisma.opportunity.findFirst({
    where: { postedByUserId: rashid.userId, title: opportunityTitle },
  });
  if (!existingOpportunity) {
    await prisma.opportunity.create({
      data: {
        postedByUserId: rashid.userId,
        businessId: business.id,
        type: "CONTRACT",
        title: opportunityTitle,
        description: "Assist with cabinetry projects, on-site in Dhaka, flexible hours.",
        skillId: carpentrySkill.id,
        locationType: "ONSITE",
        geoScope: "LOCAL",
        status: "OPEN",
      },
    });
  }

  const serviceTitle = "Custom furniture commissions";
  const rashidProfileId = people.get("rashid-islam")!.profileId;
  const existingService = await prisma.serviceOffering.findFirst({
    where: { personProfileId: rashidProfileId, title: serviceTitle },
  });
  if (!existingService) {
    await prisma.serviceOffering.create({
      data: {
        personProfileId: rashidProfileId,
        title: serviceTitle,
        description: "Bespoke furniture design and build, from kitchens to bookshelves.",
        skillId: carpentrySkill.id,
        priceNote: "Quoted per project",
      },
    });
  }
}

async function main() {
  console.log("Seeding localized labels...");
  await seedDefaultLocalizedLabels();

  console.log("Seeding skills...");
  const skillIds = await seedSkills();

  console.log("Seeding admin...");
  await seedAdmin();

  console.log("Seeding people...");
  const people = await seedPeople(skillIds);

  console.log("Seeding business...");
  const business = await seedBusiness(people);

  console.log("Seeding relationships, endorsements, feedback...");
  await seedRelationships(people);

  console.log("Seeding badge definitions...");
  await seedBadges();

  console.log("Seeding help requests, opportunities, services...");
  await seedOpportunityLayer(people, business);

  console.log(`Done. All demo accounts use password: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
