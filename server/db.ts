import { asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import { contactLinks, InsertUser, portfolioContent, portfolioProjects, users } from "../drizzle/schema";
import { getStoredContentKey, type ContentKey, type ContentLanguage } from "../shared/portfolioContent";
import type { ContactLinkType } from "../shared/contactLinks";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      const pool = createPool({
        host: url.hostname,
        port: parseInt(url.port),
        user: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, ''),
        ssl: { rejectUnauthorized: false },
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getPortfolioContent() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portfolioContent);
}

export async function savePortfolioContent(items: Array<{ key: ContentKey; value: string }>, language: ContentLanguage = "en") {
  const db = await requireDb();
  await Promise.all(items.map((item) => db.insert(portfolioContent).values({ ...item, key: getStoredContentKey(item.key, language) }).onDuplicateKeyUpdate({ set: { value: item.value, updatedAt: new Date() } })));
}

export async function getPublicPortfolioProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portfolioProjects).where(eq(portfolioProjects.isPublished, true)).orderBy(asc(portfolioProjects.sortOrder), desc(portfolioProjects.createdAt));
}

export async function getAllPortfolioProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portfolioProjects).orderBy(asc(portfolioProjects.sortOrder), desc(portfolioProjects.createdAt));
}

export type ProjectPayload = {
  title: string;
  titleAr: string | null;
  category: string;
  summary: string;
  summaryAr: string | null;
  imageUrl: string;
  projectUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
};

export async function createPortfolioProject(project: ProjectPayload) {
  const db = await requireDb();
  await db.insert(portfolioProjects).values(project);
}

export async function updatePortfolioProject(id: number, project: ProjectPayload) {
  const db = await requireDb();
  await db.update(portfolioProjects).set({ ...project, updatedAt: new Date() }).where(eq(portfolioProjects.id, id));
}

export async function deletePortfolioProject(id: number) {
  const db = await requireDb();
  await db.delete(portfolioProjects).where(eq(portfolioProjects.id, id));
}

export type ContactLinkPayload = {
  label: string;
  labelAr: string | null;
  type: ContactLinkType;
  url: string;
  sortOrder: number;
  isPublished: boolean;
};

export async function getPublicContactLinks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contactLinks).where(eq(contactLinks.isPublished, true)).orderBy(asc(contactLinks.sortOrder), desc(contactLinks.createdAt));
}

export async function getAllContactLinks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contactLinks).orderBy(asc(contactLinks.sortOrder), desc(contactLinks.createdAt));
}

export async function createContactLink(link: ContactLinkPayload) {
  const db = await requireDb();
  await db.insert(contactLinks).values(link);
}

export async function updateContactLink(id: number, link: ContactLinkPayload) {
  const db = await requireDb();
  await db.update(contactLinks).set({ ...link, updatedAt: new Date() }).where(eq(contactLinks.id, id));
}

export async function deleteContactLink(id: number) {
  const db = await requireDb();
  await db.delete(contactLinks).where(eq(contactLinks.id, id));
}
