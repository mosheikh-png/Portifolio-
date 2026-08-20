import { COOKIE_NAME } from "@shared/const";
import { CONTACT_LINK_TYPES } from "../shared/contactLinks";
import { CONTENT_DEFAULTS } from "../shared/portfolioContent";
import { createContactLink, createPortfolioProject, deleteContactLink, deletePortfolioProject, getAllContactLinks, getAllPortfolioProjects, getPortfolioContent, getPublicContactLinks, getPublicPortfolioProjects, savePortfolioContent, updateContactLink, updatePortfolioProject } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { generateProjectContent, isAIConfigured } from "./_core/ai";

const contentKeys = Object.keys(CONTENT_DEFAULTS) as [keyof typeof CONTENT_DEFAULTS, ...(keyof typeof CONTENT_DEFAULTS)[]];
const contentItemSchema = z.object({ key: z.enum(contentKeys), value: z.string().max(6000) });
const contentLanguageSchema = z.enum(["en", "ar"]);
const contentSanitizerOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "ul", "ol", "li", "h2", "h3", "blockquote"],
  allowedAttributes: {},
  allowedSchemes: [],
};
const projectSchema = z.object({
  title: z.string().min(1).max(180),
  titleAr: z.string().max(180).nullish().transform((value) => value ?? null),
  category: z.string().min(1).max(140),
  summary: z.string().min(1).max(6000),
  summaryAr: z.string().max(6000).nullish().transform((value) => value ?? null),
  imageUrl: z.string().min(1).max(5000),
  projectUrl: z.string().url().max(512).nullable(),
  sortOrder: z.number().int().min(0).max(10000),
  isPublished: z.boolean(),
});
const imageContentTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const imageUploadSchema = z.object({
  filename: z.string().min(1).max(180),
  contentType: imageContentTypeSchema,
  dataUrl: z.string().min(40).max(12_000_000),
});
const contactLinkSchema = z.object({
  label: z.string().min(1).max(100),
  labelAr: z.string().max(100).nullish().transform((value) => value?.trim() || null),
  type: z.enum(CONTACT_LINK_TYPES),
  url: z.string().min(3).max(1024),
  sortOrder: z.number().int().min(0).max(10000),
  isPublished: z.boolean(),
}).superRefine(({ type, url }, context) => {
  if (type === "phone") {
    if (!/^tel:\+?[0-9().\-\s]{5,32}$/.test(url)) context.addIssue({ code: "custom", path: ["url"], message: "Phone links must use the tel:+201234567890 format" });
    return;
  }

  try {
    const protocol = new URL(url).protocol;
    if (protocol !== "https:" && protocol !== "http:") throw new Error("Unsupported protocol");
  } catch {
    context.addIssue({ code: "custom", path: ["url"], message: "Links must use a valid http or https URL" });
  }
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  cms: router({
    publicContent: publicProcedure.query(() => getPortfolioContent()),
    publicProjects: publicProcedure.query(() => getPublicPortfolioProjects()),
    publicContactLinks: publicProcedure.query(() => getPublicContactLinks()),
    adminContent: adminProcedure.query(() => getPortfolioContent()),
    adminProjects: adminProcedure.query(() => getAllPortfolioProjects()),
    adminContactLinks: adminProcedure.query(() => getAllContactLinks()),
    updateContent: adminProcedure.input(z.object({ language: contentLanguageSchema.optional().default("en"), items: z.array(contentItemSchema).min(1).max(Object.keys(CONTENT_DEFAULTS).length) })).mutation(async ({ input }) => {
      const items = input.items.map((item) => ({ ...item, value: sanitizeHtml(item.value, contentSanitizerOptions) }));
      await savePortfolioContent(items, input.language);
      return { success: true };
    }),
    createProject: adminProcedure.input(projectSchema).mutation(async ({ input }) => { await createPortfolioProject(input); return { success: true }; }),
    updateProject: adminProcedure.input(projectSchema.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => { const { id, ...project } = input; await updatePortfolioProject(id, project); return { success: true }; }),
    deleteProject: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => { await deletePortfolioProject(input.id); return { success: true }; }),
    createContactLink: adminProcedure.input(contactLinkSchema).mutation(async ({ input }) => { await createContactLink(input); return { success: true }; }),
    updateContactLink: adminProcedure.input(contactLinkSchema.safeExtend({ id: z.number().int().positive() })).mutation(async ({ input }) => { const { id, ...link } = input; await updateContactLink(id, link); return { success: true }; }),
    deleteContactLink: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => { await deleteContactLink(input.id); return { success: true }; }),
    uploadProjectImage: adminProcedure.input(imageUploadSchema).mutation(async ({ input, ctx }) => {
      const dataUrlPrefix = `data:${input.contentType};base64,`;
      if (!input.dataUrl.startsWith(dataUrlPrefix)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Image data does not match its declared type" });
      }
      const encoded = input.dataUrl.slice(dataUrlPrefix.length);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Image data is not valid base64" });
      }
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.byteLength > 8 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Image must be 8MB or smaller" });
      const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
      return storagePut(`portfolio/${ctx.user.id}/projects/${safeFilename}`, bytes, input.contentType);
    }),
    aiStatus: adminProcedure.query(() => ({ configured: isAIConfigured() })),
    generateProjectContent: adminProcedure
      .input(z.object({
        title: z.string().max(180).optional(),
        category: z.string().max(140).optional(),
        summary: z.string().max(6000).optional(),
        tools: z.string().max(500).optional(),
        client: z.string().max(200).optional(),
        adminDescription: z.string().max(4000).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await generateProjectContent(input);
          return { success: true, data: result };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error?.message || "AI generation failed",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
