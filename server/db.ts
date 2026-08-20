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
        connectTimeout: 15000,
      });
      const promisePool = pool.promise();
      await promisePool.query("SELECT 1");
      console.log("[Database] Connection verified successfully");

      _db = drizzle(pool);

      try {
        await promisePool.query(`
          CREATE TABLE IF NOT EXISTS \`users\` (
            \`id\` int AUTO_INCREMENT NOT NULL,
            \`openId\` varchar(64) NOT NULL,
            \`name\` text,
            \`email\` varchar(320),
            \`loginMethod\` varchar(64),
            \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
            \`createdAt\` timestamp NOT NULL DEFAULT (now()),
            \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
            \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()),
            CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
            CONSTRAINT \`users_openId_unique\` UNIQUE(\`openId\`)
          )
        `);
        await promisePool.query(`
          CREATE TABLE IF NOT EXISTS \`portfolio_content\` (
            \`key\` varchar(96) NOT NULL,
            \`value\` text NOT NULL,
            \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT \`portfolio_content_key\` PRIMARY KEY(\`key\`)
          )
        `);
        await promisePool.query(`
          CREATE TABLE IF NOT EXISTS \`portfolio_projects\` (
            \`id\` int AUTO_INCREMENT NOT NULL,
            \`title\` varchar(180) NOT NULL,
            \`titleAr\` varchar(180),
            \`category\` varchar(140) NOT NULL,
            \`summary\` text NOT NULL,
            \`summaryAr\` text,
            \`imageUrl\` text NOT NULL,
            \`projectUrl\` varchar(512),
            \`sortOrder\` int NOT NULL DEFAULT 0,
            \`isPublished\` boolean NOT NULL DEFAULT true,
            \`createdAt\` timestamp NOT NULL DEFAULT (now()),
            \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT \`portfolio_projects_id\` PRIMARY KEY(\`id\`)
          )
        `);
        await promisePool.query(`
          CREATE TABLE IF NOT EXISTS \`contact_links\` (
            \`id\` int AUTO_INCREMENT NOT NULL,
            \`label\` varchar(100) NOT NULL,
            \`labelAr\` varchar(100),
            \`type\` enum('phone','whatsapp','instagram','linkedin','behance','facebook','x','website','other') NOT NULL,
            \`url\` varchar(1024) NOT NULL,
            \`sortOrder\` int NOT NULL DEFAULT 0,
            \`isPublished\` boolean NOT NULL DEFAULT true,
            \`createdAt\` timestamp NOT NULL DEFAULT (now()),
            \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT \`contact_links_id\` PRIMARY KEY(\`id\`)
          )
        `);
        console.log("[Database] All tables verified/created");
      } catch (tableErr: any) {
        console.warn("[Database] Table auto-creation skipped (tables may already exist):", tableErr?.message || tableErr);
      }
    } catch (error: any) {
      console.error("[Database] Failed to initialize:", error?.message || error);
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

  try {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error: any) {
    console.error("[Database] getUserByOpenId failed:", error?.message || error);
    return undefined;
  }
}

export async function getPortfolioContent() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(portfolioContent);
  } catch (error: any) {
    console.error("[Database] getPortfolioContent failed:", error?.message || error);
    return [];
  }
}

export async function savePortfolioContent(items: Array<{ key: ContentKey; value: string }>, language: ContentLanguage = "en") {
  const db = await requireDb();
  await Promise.all(items.map((item) => db.insert(portfolioContent).values({ ...item, key: getStoredContentKey(item.key, language) }).onDuplicateKeyUpdate({ set: { value: item.value, updatedAt: new Date() } })));
}

export async function getPublicPortfolioProjects() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(portfolioProjects).where(eq(portfolioProjects.isPublished, true)).orderBy(asc(portfolioProjects.sortOrder), desc(portfolioProjects.createdAt));
  } catch (error: any) {
    console.error("[Database] getPublicPortfolioProjects failed:", error?.message || error);
    return [];
  }
}

export async function getAllPortfolioProjects() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(portfolioProjects).orderBy(asc(portfolioProjects.sortOrder), desc(portfolioProjects.createdAt));
  } catch (error: any) {
    console.error("[Database] getAllPortfolioProjects failed:", error?.message || error);
    return [];
  }
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
  try {
    await db.insert(portfolioProjects).values(project);
  } catch (error: any) {
    console.error("[Database] createPortfolioProject failed:", error?.message || error);
    throw error;
  }
}

export async function updatePortfolioProject(id: number, project: ProjectPayload) {
  const db = await requireDb();
  try {
    await db.update(portfolioProjects).set({ ...project, updatedAt: new Date() }).where(eq(portfolioProjects.id, id));
  } catch (error: any) {
    console.error("[Database] updatePortfolioProject failed:", error?.message || error);
    throw error;
  }
}

export async function deletePortfolioProject(id: number) {
  const db = await requireDb();
  try {
    await db.delete(portfolioProjects).where(eq(portfolioProjects.id, id));
  } catch (error: any) {
    console.error("[Database] deletePortfolioProject failed:", error?.message || error);
    throw error;
  }
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
  try {
    return await db.select().from(contactLinks).where(eq(contactLinks.isPublished, true)).orderBy(asc(contactLinks.sortOrder), desc(contactLinks.createdAt));
  } catch (error: any) {
    console.error("[Database] getPublicContactLinks failed:", error?.message || error);
    return [];
  }
}

export async function getAllContactLinks() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(contactLinks).orderBy(asc(contactLinks.sortOrder), desc(contactLinks.createdAt));
  } catch (error: any) {
    console.error("[Database] getAllContactLinks failed:", error?.message || error);
    return [];
  }
}

export async function createContactLink(link: ContactLinkPayload) {
  const db = await requireDb();
  try {
    await db.insert(contactLinks).values(link);
  } catch (error: any) {
    console.error("[Database] createContactLink failed:", error?.message || error);
    throw error;
  }
}

export async function updateContactLink(id: number, link: ContactLinkPayload) {
  const db = await requireDb();
  try {
    await db.update(contactLinks).set({ ...link, updatedAt: new Date() }).where(eq(contactLinks.id, id));
  } catch (error: any) {
    console.error("[Database] updateContactLink failed:", error?.message || error);
    throw error;
  }
}

export async function deleteContactLink(id: number) {
  const db = await requireDb();
  try {
    await db.delete(contactLinks).where(eq(contactLinks.id, id));
  } catch (error: any) {
    console.error("[Database] deleteContactLink failed:", error?.message || error);
    throw error;
  }
}
