import { describe, expect, it, vi } from "vitest";
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

const aiModule = vi.hoisted(() => ({
  isAIConfigured: vi.fn(() => true),
  generateProjectContent: vi.fn(async () => ({
    title: "AI Generated Project",
    titleAr: "مشروع مولّد بالذكاء الاصطناعي",
    category: "Social Media",
    summary: "A professional social media campaign for a modern brand.",
    summaryAr: "حملة احترافية على وسائل التواصل الاجتماعي لعلامة تجارية حديثة.",
    projectUrl: null,
  })),
}));

vi.mock("./db", () => db);
vi.mock("./storage", () => storage);
vi.mock("./_core/ai", () => aiModule);

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

describe("AI generation — configuration", () => {
  it("returns configured status when AI is set up", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.cms.aiStatus();
    expect(result.configured).toBe(true);
  });

  it("returns not-configured status when AI is disabled", async () => {
    aiModule.isAIConfigured.mockReturnValueOnce(false);
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.cms.aiStatus();
    expect(result.configured).toBe(false);
  });
});

describe("AI generation — authorization", () => {
  it("rejects AI generation from a non-admin user", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.cms.generateProjectContent({})).rejects.toMatchObject({ message: expect.stringContaining("permission") });
  });

  it("allows admin to generate content", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.cms.generateProjectContent({});
    expect(result).toEqual({ success: true, data: expect.objectContaining({ title: "AI Generated Project", category: "Social Media" }) });
  });
});

describe("AI generation — input handling", () => {
  it("passes admin input to the AI provider", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await caller.cms.generateProjectContent({ title: "My Project", category: "Book Cover", adminDescription: "A book cover design" });
    expect(aiModule.generateProjectContent).toHaveBeenCalledWith(expect.objectContaining({ title: "My Project", category: "Book Cover", adminDescription: "A book cover design" }));
  });

  it("handles empty input", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.cms.generateProjectContent({});
    expect(result.success).toBe(true);
  });
});

describe("AI generation — error handling", () => {
  it("returns error when AI is not configured", async () => {
    aiModule.isAIConfigured.mockReturnValueOnce(false);
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("AI is not configured. Set AI_PROVIDER and AI_API_KEY environment variables."));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent({})).rejects.toMatchObject({ message: "AI is not configured. Set AI_PROVIDER and AI_API_KEY environment variables." });
  });

  it("returns error when AI provider fails", async () => {
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("AI provider returned 500: Internal Server Error"));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent({})).rejects.toMatchObject({ message: "AI provider returned 500: Internal Server Error" });
  });

  it("returns error when AI returns invalid JSON", async () => {
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("AI provider returned invalid JSON"));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent({})).rejects.toMatchObject({ message: "AI provider returned invalid JSON" });
  });

  it("returns error when AI output fails schema validation", async () => {
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("AI output validation failed: Required"));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent({})).rejects.toMatchObject({ message: "AI output validation failed: Required" });
  });
});

describe("AI generation — output structure", () => {
  it("returns all expected fields", async () => {
    aiModule.generateProjectContent.mockResolvedValueOnce({
      title: "Brand Campaign",
      titleAr: "حملة العلامة التجارية",
      category: "Social Media",
      summary: "A comprehensive social media campaign.",
      summaryAr: "حملة شاملة على وسائل التواصل الاجتماعي.",
      projectUrl: null,
    });
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.cms.generateProjectContent({});
    expect(result.data).toHaveProperty("title");
    expect(result.data).toHaveProperty("titleAr");
    expect(result.data).toHaveProperty("category");
    expect(result.data).toHaveProperty("summary");
    expect(result.data).toHaveProperty("summaryAr");
    expect(result.data).toHaveProperty("projectUrl");
  });
});

describe("AI generation — does not auto-publish", () => {
  it("AI endpoint does not call createProject or updateProject", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await caller.cms.generateProjectContent({});
    expect(db.createPortfolioProject).not.toHaveBeenCalled();
    expect(db.updatePortfolioProject).not.toHaveBeenCalled();
  });
});

describe("CMS project CRUD — manual creation still works", () => {
  it("admin can create, update, and delete projects without AI", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const project = {
      title: "Manual Project",
      titleAr: "مشروع يدوي",
      category: "Photo Manipulation",
      summary: "A manually created project.",
      summaryAr: "مشروع أُنشأ يدويًا.",
      imageUrl: "/manus-storage/manual.png",
      projectUrl: null,
      sortOrder: 0,
      isPublished: true,
    };
    await expect(caller.cms.createProject(project)).resolves.toEqual({ success: true });
    expect(db.createPortfolioProject).toHaveBeenCalledWith(project);
    await expect(caller.cms.updateProject({ id: 1, ...project })).resolves.toEqual({ success: true });
    await expect(caller.cms.deleteProject({ id: 1 })).resolves.toEqual({ success: true });
  });
});
