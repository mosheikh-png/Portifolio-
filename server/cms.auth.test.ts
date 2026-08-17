import { describe, expect, it, vi } from "vitest";
import { NOT_ADMIN_ERR_MSG } from "../shared/const";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  getPortfolioContent: vi.fn(async () => []),
  getPublicPortfolioProjects: vi.fn(async () => []),
  getPublicContactLinks: vi.fn(async () => []),
  getAllPortfolioProjects: vi.fn(async () => []),
  getAllContactLinks: vi.fn(async () => []),
  savePortfolioContent: vi.fn(async () => undefined),
  createPortfolioProject: vi.fn(async () => undefined),
  updatePortfolioProject: vi.fn(async () => undefined),
  deletePortfolioProject: vi.fn(async () => undefined),
  createContactLink: vi.fn(async () => undefined),
  updateContactLink: vi.fn(async () => undefined),
  deleteContactLink: vi.fn(async () => undefined),
}));

const storage = vi.hoisted(() => ({ storagePut: vi.fn(async () => ({ key: "portfolio/test/project.png", url: "/manus-storage/portfolio/test/project.png" })) }));

vi.mock("./db", () => db);
vi.mock("./storage", () => storage);

const { appRouter } = await import("./routers");

function createContext(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-user`,
      name: `${role} user`,
      email: `${role}@example.com`,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

const project = {
  title: "Test project",
  titleAr: "مشروع اختباري",
  category: "Brand identity",
  summary: "A safe in-memory test project.",
  summaryAr: "مشروع اختباري آمن داخل الذاكرة.",
  imageUrl: "/manus-storage/test-project.png",
  projectUrl: null,
  sortOrder: 0,
  isPublished: true,
};

const image = {
  filename: "project.png",
  contentType: "image/png",
  dataUrl: `data:image/png;base64,${"A".repeat(60)}`,
};

const contactLink = {
  label: "Call Mohamed",
  labelAr: "اتصل بمحمد",
  type: "phone" as const,
  url: "tel:+201234567890",
  sortOrder: 0,
  isPublished: true,
};

describe("CMS admin authorization", () => {
  it("rejects every protected CMS action from a non-admin user", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    const forbidden = { message: NOT_ADMIN_ERR_MSG };

    await expect(caller.cms.adminContent()).rejects.toMatchObject(forbidden);
    await expect(caller.cms.adminProjects()).rejects.toMatchObject(forbidden);
    await expect(caller.cms.adminContactLinks()).rejects.toMatchObject(forbidden);
    await expect(caller.cms.updateContent({ items: [{ key: "homeName", value: "Blocked" }] })).rejects.toMatchObject(forbidden);
    await expect(caller.cms.createProject(project)).rejects.toMatchObject(forbidden);
    await expect(caller.cms.updateProject({ id: 1, ...project })).rejects.toMatchObject(forbidden);
    await expect(caller.cms.deleteProject({ id: 1 })).rejects.toMatchObject(forbidden);
    await expect(caller.cms.createContactLink(contactLink)).rejects.toMatchObject(forbidden);
    await expect(caller.cms.updateContactLink({ id: 1, ...contactLink })).rejects.toMatchObject(forbidden);
    await expect(caller.cms.deleteContactLink({ id: 1 })).rejects.toMatchObject(forbidden);
    await expect(caller.cms.uploadProjectImage(image)).rejects.toMatchObject(forbidden);
  });

  it("allows an admin to read, save, and manage content, projects, and contact links", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(caller.cms.adminContent()).resolves.toEqual([]);
    await expect(caller.cms.adminProjects()).resolves.toEqual([]);
    await expect(caller.cms.adminContactLinks()).resolves.toEqual([]);
    await expect(caller.cms.updateContent({ items: [{ key: "homeName", value: "Mohamed A." }] })).resolves.toEqual({ success: true });
    await expect(caller.cms.updateContent({ language: "ar", items: [{ key: "aboutLead", value: "<p>مرحبًا <strong>بك</strong><script>alert(1)</script></p>" }] })).resolves.toEqual({ success: true });
    await expect(caller.cms.createProject(project)).resolves.toEqual({ success: true });
    await expect(caller.cms.updateProject({ id: 1, ...project, title: "Updated project" })).resolves.toEqual({ success: true });
    await expect(caller.cms.deleteProject({ id: 1 })).resolves.toEqual({ success: true });
    await expect(caller.cms.createContactLink(contactLink)).resolves.toEqual({ success: true });
    await expect(caller.cms.updateContactLink({ id: 1, ...contactLink, label: "Updated contact" })).resolves.toEqual({ success: true });
    await expect(caller.cms.deleteContactLink({ id: 1 })).resolves.toEqual({ success: true });
    await expect(caller.cms.createContactLink({ ...contactLink, type: "website", url: "javascript:alert(1)" })).rejects.toThrow("Links must use a valid http or https URL");
    await expect(caller.cms.uploadProjectImage(image)).resolves.toEqual({ key: "portfolio/test/project.png", url: "/manus-storage/portfolio/test/project.png" });

    expect(db.savePortfolioContent).toHaveBeenCalledWith([{ key: "homeName", value: "Mohamed A." }], "en");
    expect(db.savePortfolioContent).toHaveBeenCalledWith([{ key: "aboutLead", value: "<p>مرحبًا <strong>بك</strong></p>" }], "ar");
    expect(db.createPortfolioProject).toHaveBeenCalledWith(project);
    expect(db.updatePortfolioProject).toHaveBeenCalledWith(1, expect.objectContaining({ titleAr: project.titleAr, summaryAr: project.summaryAr }));
    expect(db.deletePortfolioProject).toHaveBeenCalledOnce();
    expect(db.createContactLink).toHaveBeenCalledWith(contactLink);
    expect(db.updateContactLink).toHaveBeenCalledWith(1, expect.objectContaining({ label: "Updated contact" }));
    expect(db.deleteContactLink).toHaveBeenCalledOnce();
    expect(storage.storagePut).toHaveBeenCalledOnce();
  });
});
