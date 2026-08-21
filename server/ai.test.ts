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
    title: "Visual Identity System",
    titleAr: "نظام الهوية البصرية",
    category: "Social Media",
    summary: "A cohesive social media design system built on a restrained dark palette with high-contrast typography. The composition directs attention through strategic use of negative space and a clear visual hierarchy from headline to supporting graphic elements.",
    summaryAr: "نظام تصميم متماسك لوسائل التواصل الاجتماعي مبني على لوحة داكنة مقيدة مع تباين عالي في الخطوط. يوجه التكوين الانتباه من خلال الاستخدام الاستراتيجي للمساحة السلبية وتراتبية بصرية واضحة.",
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

const validAiInput = {
  imageUrl: "/manus-storage/portfolio/1/projects/design_abc123.png",
  language: "en" as const,
  category: "Social Media",
};

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
    await expect(caller.cms.generateProjectContent(validAiInput)).rejects.toMatchObject({ message: expect.stringContaining("permission") });
  });

  it("allows admin to generate content", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.cms.generateProjectContent(validAiInput);
    expect(result).toEqual({ success: true, data: expect.objectContaining({ title: "Visual Identity System", category: "Social Media" }) });
  });
});

describe("AI generation — input validation", () => {
  it("requires imageUrl", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent({ category: "Social Media", language: "en" })).rejects.toThrow();
  });

  it("requires category", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent({ imageUrl: "/manus-storage/test.png", language: "en" })).rejects.toThrow();
  });

  it("accepts valid input with all fields", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    aiModule.generateProjectContent.mockResolvedValueOnce({
      title: "Brand Campaign",
      titleAr: null,
      category: "Social Media",
      summary: "A campaign design.",
      summaryAr: null,
      projectUrl: null,
    });
    const result = await caller.cms.generateProjectContent({
      imageUrl: "/manus-storage/test.png",
      language: "en",
      title: "Brand Campaign",
      category: "Social Media",
      tools: "Figma",
      client: "Test Client",
      adminDescription: "A brand campaign for social media",
    });
    expect(result.success).toBe(true);
  });

  it("defaults language to en", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await caller.cms.generateProjectContent({ imageUrl: "/manus-storage/test.png", category: "Social Media" });
    expect(aiModule.generateProjectContent).toHaveBeenCalledWith(expect.objectContaining({ language: "en" }));
  });

  it("accepts Arabic language", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await caller.cms.generateProjectContent({ imageUrl: "/manus-storage/test.png", language: "ar", category: "Social Media" });
    expect(aiModule.generateProjectContent).toHaveBeenCalledWith(expect.objectContaining({ language: "ar" }));
  });
});

describe("AI generation — image required", () => {
  it("passes imageUrl to the AI module", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await caller.cms.generateProjectContent({
      imageUrl: "/manus-storage/portfolio/1/projects/design_abc123.png",
      language: "en",
      category: "Social Media",
    });
    expect(aiModule.generateProjectContent).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: "/manus-storage/portfolio/1/projects/design_abc123.png" })
    );
  });
});

describe("AI generation — error handling", () => {
  it("returns error when AI is not configured", async () => {
    aiModule.isAIConfigured.mockReturnValueOnce(false);
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("AI is not configured. Set AI_PROVIDER and AI_API_KEY environment variables."));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent(validAiInput)).rejects.toMatchObject({ message: "AI is not configured. Set AI_PROVIDER and AI_API_KEY environment variables." });
  });

  it("returns error when AI provider fails", async () => {
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("AI provider returned 500: Internal Server Error"));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent(validAiInput)).rejects.toMatchObject({ message: "AI provider returned 500: Internal Server Error" });
  });

  it("returns error when AI returns invalid JSON", async () => {
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("AI returned invalid JSON. Please try again."));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent(validAiInput)).rejects.toMatchObject({ message: "AI returned invalid JSON. Please try again." });
  });

  it("returns error when AI output fails schema validation", async () => {
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error('AI response validation failed: title: Required'));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent(validAiInput)).rejects.toMatchObject({ message: 'AI response validation failed: title: Required' });
  });

  it("handles Gemini quota error gracefully", async () => {
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("AI quota exceeded. Please try again in a few minutes."));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent(validAiInput)).rejects.toMatchObject({ message: "AI quota exceeded. Please try again in a few minutes." });
  });

  it("handles AI timeout gracefully", async () => {
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("AI generation timed out. The image may be too complex — try a smaller image."));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent(validAiInput)).rejects.toMatchObject({ message: "AI generation timed out. The image may be too complex — try a smaller image." });
  });

  it("handles unsupported image format", async () => {
    aiModule.generateProjectContent.mockRejectedValueOnce(new Error("Unsupported image format: .bmp. Use JPEG, PNG, WebP, or GIF."));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.cms.generateProjectContent({ imageUrl: "/manus-storage/test.bmp", category: "Social Media", language: "en" })).rejects.toMatchObject({ message: "Unsupported image format: .bmp. Use JPEG, PNG, WebP, or GIF." });
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
    const result = await caller.cms.generateProjectContent(validAiInput);
    expect(result.data).toHaveProperty("title");
    expect(result.data).toHaveProperty("titleAr");
    expect(result.data).toHaveProperty("category");
    expect(result.data).toHaveProperty("summary");
    expect(result.data).toHaveProperty("summaryAr");
    expect(result.data).toHaveProperty("projectUrl");
  });

  it("generates art-direction quality summary", async () => {
    aiModule.generateProjectContent.mockResolvedValueOnce({
      title: "Dark Palette Campaign",
      titleAr: null,
      category: "Social Media",
      summary: "The composition employs a restrained dark palette with a strong central focal point, supported by high-contrast typography and controlled negative space. The visual hierarchy directs attention from the primary headline toward supporting graphic elements, creating a deliberate rhythm across the layout.",
      summaryAr: null,
      projectUrl: null,
    });
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.cms.generateProjectContent(validAiInput);
    expect(result.data.summary).toContain("palette");
    expect(result.data.summary).toContain("typography");
  });
});

describe("AI generation — does not auto-publish", () => {
  it("AI endpoint does not call createProject or updateProject", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await caller.cms.generateProjectContent(validAiInput);
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

  it("admin can edit existing projects", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const project = {
      title: "Existing Project",
      titleAr: "مشروع موجود",
      category: "Book Cover",
      summary: "An existing project to edit.",
      summaryAr: "مشروع موجود للتعديل.",
      imageUrl: "/manus-storage/existing.png",
      projectUrl: "https://example.com",
      sortOrder: 1,
      isPublished: false,
    };
    await expect(caller.cms.updateProject({ id: 5, ...project })).resolves.toEqual({ success: true });
    expect(db.updatePortfolioProject).toHaveBeenCalledWith(5, expect.objectContaining({ title: "Existing Project" }));
  });
});
