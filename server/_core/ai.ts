/**
 * AI Content Generation Provider — Gemini Vision
 *
 * Server-side only. Uses the Google Gemini API for image-aware portfolio content generation.
 * Configured via environment variables:
 *   AI_PROVIDER  — "gemini" (required)
 *   AI_API_KEY   — Google Gemini API key
 *   AI_MODEL     — Gemini model (default: "gemini-2.0-flash")
 *   AI_BASE_URL  — Gemini API base (default: "https://generativelanguage.googleapis.com")
 *
 * The AI analyzes an actual uploaded image and generates category-aware
 * art-direction / design descriptions for the portfolio.
 */

import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const AI_PROVIDER = process.env.AI_PROVIDER ?? "";
const AI_API_KEY = process.env.AI_API_KEY ?? "";
const AI_MODEL = process.env.AI_MODEL ?? "gemini-2.0-flash";
const AI_BASE_URL = (process.env.AI_BASE_URL ?? "https://generativelanguage.googleapis.com").replace(/\/+$/, "");

export function isAIConfigured(): boolean {
  return Boolean(AI_PROVIDER && AI_API_KEY);
}

// --- Input schema (what the admin provides) ---

const GenerateInputSchema = z.object({
  imageUrl: z.string().min(1).max(5000),
  language: z.enum(["en", "ar"]).optional(),
  title: z.string().min(1).max(180).optional(),
  category: z.string().min(1).max(140),
  summary: z.string().min(1).max(6000).optional(),
  tools: z.string().min(1).max(500).optional(),
  client: z.string().min(1).max(200).optional(),
  adminDescription: z.string().min(1).max(4000).optional(),
});

export type GenerateInput = z.infer<typeof GenerateInputSchema>;

// --- Output schema (validated against AI response) ---

const GenerateOutputSchema = z.object({
  title: z.string().min(1).max(180),
  titleAr: z.string().max(180).nullable(),
  category: z.string().min(1).max(140),
  summary: z.string().min(1).max(6000),
  summaryAr: z.string().max(6000).nullable(),
  projectUrl: z.string().max(512).nullable(),
});

export type GenerateOutput = z.infer<typeof GenerateOutputSchema>;

// --- Constants ---

const VALID_CATEGORIES = [
  "Social Media",
  "Photo Manipulation",
  "Book Cover",
  "PowerPoint Presentation",
  "Photo Retouching",
  "YouTube Thumbnail",
];

const MAX_INPUT_CHARS = 12_000;
const AI_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_TOKENS = 1200;

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const ALLOWED_MIMES = new Set(Object.values(MIME_MAP));

// --- Image reader ---

async function readImageFromStorage(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const storageKey = imageUrl.replace(/^\/manus-storage\//, "").replace(/^manus-storage\//, "");
  if (!storageKey) throw new Error("Invalid image URL — no storage key found");

  const ext = path.extname(storageKey).toLowerCase();
  const mimeType = MIME_MAP[ext];
  if (!mimeType) throw new Error(`Unsupported image format: ${ext || "unknown"}. Use JPEG, PNG, WebP, or GIF.`);

  if (process.env.STORAGE_DRIVER === "local") {
    const storageDir = path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || "assets/public");
    const filePath = path.resolve(storageDir, storageKey);
    if (!filePath.startsWith(storageDir)) throw new Error("Storage path escapes local storage directory");
    const buffer = await fs.readFile(filePath);
    if (buffer.byteLength > 10 * 1024 * 1024) throw new Error("Image exceeds 10MB limit for AI processing");
    return { base64: buffer.toString("base64"), mimeType };
  }

  throw new Error("AI image reading requires local storage driver");
}

// --- Gemini API response type ---

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// --- Category-specific analysis guidance ---

function getCategoryGuidance(category: string): string {
  const guideMap: Record<string, string> = {
    "Social Media": `Analyze the social media design:
- Post format and platform intent (feed, story, carousel)
- Visual concept and narrative
- Composition and layout system
- Typography hierarchy and treatment
- Color palette and grading
- Graphic elements, overlays, and text placement
- Visual rhythm and brand consistency
- Communication goal and content strategy`,
    "Photo Manipulation": `Analyze the photo manipulation:
- Compositing technique and blending approach
- Subject matter and visual concept
- Lighting direction and consistency across elements
- Color grading and tonal treatment
- Retouching and manipulation techniques visible
- Visual storytelling and narrative intent
- Texture, depth, and atmospheric effects
- Edge work and mask quality`,
    "Book Cover": `Analyze the book cover design:
- Genre indicators and visual tone
- Typography as primary design element
- Illustration or photographic treatment
- Layout hierarchy (title, author, imagery)
- Color mood and genre-appropriate palette
- Market positioning through visual design
- Print considerations (spine, back cover if visible)
- Visual metaphor or symbolic elements`,
    "PowerPoint Presentation": `Analyze the presentation design:
- Slide layout system and grid
- Typography hierarchy across slides
- Color system and brand application
- Data visualization approach
- Visual consistency and template design
- Content organization and information architecture
- Image treatment and integration
- Transition or animation cues if visible`,
    "Photo Retouching": `Analyze the photo retouching:
- Skin treatment and beauty retouching approach
- Color correction and tonal adjustments
- Lighting enhancement and directional control
- Detail work (eyes, hair, texture preservation)
- Before/after quality indicators
- Beauty or fashion industry context
- Makeup or cosmetic enhancement if visible
- Professional finish level and technique`,
    "YouTube Thumbnail": `Analyze the YouTube thumbnail:
- Click-worthiness and visual impact at small size
- Face or subject prominence
- Text overlay hierarchy and readability
- Color contrast and saturation choices
- Emotional hook and viewer intent
- Composition for 16:9 crop
- Brand or channel identity elements
- Thumbnail genre conventions followed`,
  };
  return guideMap[category] || `Analyze the design in this image:
- Visual subject and design type
- Composition and layout
- Typography and color palette
- Visual hierarchy and graphical elements
- Style, mood, and technical execution
- Any branding elements visible`;
}

// --- System prompt ---

function buildSystemPrompt(language: string): string {
  const langInstruction = language === "ar"
    ? "Write the summary and titleAr fields in natural, professional Arabic. Do not use literal machine translation."
    : "Write in English. For titleAr and summaryAr, provide natural Arabic translations only if clearly appropriate; otherwise set them to null.";

  return `You are a professional art-director and portfolio writer for graphic designer Mohamed Adel.

Your task: analyze the uploaded design image and generate portfolio project content.

RULES — CRITICAL:
- Analyze ONLY what is actually visible in the image
- NEVER invent client names, brands, awards, statistics, dates, or business outcomes
- NEVER invent software/tools unless clearly identifiable in the image
- NEVER use filler words: "modern", "innovative", "creative", "stunning", "eye-catching", "professional" unless the image genuinely supports them
- Write like a professional designer presenting art direction — technical, specific, visual
- Describe WHAT was designed, WHAT the visual idea is, HOW the design works, WHY the direction makes sense
- If something cannot be determined from the image, use neutral wording
- Category must match exactly one of the provided options
- Output ONLY valid JSON — no markdown, no code fences, no commentary

LANGUAGE:
${langInstruction}

OUTPUT: Return a JSON object with exactly these fields:
{
  "title": "Short portfolio-appropriate title (5-8 words, based on the visual content)",
  "titleAr": "Arabic title or null",
  "category": "Exact category from the provided list",
  "summary": "Professional art-direction description (3-5 sentences) covering visual concept, composition, typography, color, technique, and design rationale. Write this like a design case-study paragraph — specific to what you see in the image.",
  "summaryAr": "Arabic version of the summary or null",
  "projectUrl": null
}`;
}

// --- User prompt builder ---

function buildUserPrompt(input: GenerateInput): string {
  const categoryList = VALID_CATEGORIES.join(", ");
  const parts: string[] = [];

  parts.push(`Category: ${input.category}`);

  if (input.title) parts.push(`Admin-provided title: ${input.title}`);
  if (input.client) parts.push(`Client: ${input.client}`);
  if (input.tools) parts.push(`Tools/technologies: ${input.tools}`);
  if (input.summary) parts.push(`Admin notes: ${input.summary}`);
  if (input.adminDescription) parts.push(`Additional context: ${input.adminDescription}`);

  const categoryGuidance = getCategoryGuidance(input.category);

  return `Analyze the design image attached to this request.

${categoryGuidance}

${parts.length > 0 ? "Admin-provided information:\n" + parts.join("\n") : "No additional information provided — base the analysis entirely on the image."}

Valid categories: ${categoryList}
Target category: ${input.category}

Generate the JSON response now.`;
}

// --- Gemini API call ---

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  imageData?: { base64: string; mimeType: string },
): Promise<string> {
  const url = `${AI_BASE_URL}/v1beta/models/${AI_MODEL}:generateContent?key=${AI_API_KEY}`;

  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
    { text: `${systemPrompt}\n\n${userPrompt}` },
  ];

  if (imageData) {
    parts.push({
      inline_data: {
        mime_type: imageData.mimeType,
        data: imageData.base64,
      },
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as GeminiResponse | null;
    const errorMsg = body?.error?.message || response.statusText;

    if (response.status === 429 || body?.error?.status === "RESOURCE_EXHAUSTED") {
      throw new Error("AI quota exceeded. Please try again in a few minutes.");
    }
    if (response.status === 403) {
      throw new Error("Invalid AI API key or insufficient permissions.");
    }
    if (response.status === 400) {
      throw new Error(`AI request rejected: ${errorMsg}`);
    }
    throw new Error(`AI provider returned ${response.status}: ${errorMsg}`);
  }

  const data = await response.json() as GeminiResponse;

  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content || typeof content !== "string") {
    throw new Error("AI returned empty content. The image may be unsupported or too large.");
  }

  return content;
}

// --- Main generation function ---

export async function generateProjectContent(input: GenerateInput): Promise<GenerateOutput> {
  if (!isAIConfigured()) {
    throw new Error("AI is not configured. Set AI_PROVIDER and AI_API_KEY environment variables.");
  }

  if (AI_PROVIDER.toLowerCase() !== "gemini") {
    throw new Error(`Unsupported AI provider: ${AI_PROVIDER}. Only "gemini" is supported.`);
  }

  const validated = GenerateInputSchema.parse(input);

  const inputLength = [
    validated.title,
    validated.category,
    validated.summary,
    validated.tools,
    validated.client,
    validated.adminDescription,
  ].filter(Boolean).join("").length;

  if (inputLength > MAX_INPUT_CHARS) {
    throw new Error(`Input too long (${inputLength} characters, max ${MAX_INPUT_CHARS}).`);
  }

  let imageData: { base64: string; mimeType: string } | undefined;
  try {
    imageData = await readImageFromStorage(validated.imageUrl);
  } catch (err: any) {
    throw new Error(`Failed to read image: ${err?.message || "unknown error"}`);
  }

  const language = validated.language ?? "en";

  const systemPrompt = buildSystemPrompt(language);
  const userPrompt = buildUserPrompt(validated);

  let raw: string;
  try {
    raw = await callGemini(systemPrompt, userPrompt, imageData);
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.message?.includes("timeout")) {
      throw new Error("AI generation timed out. The image may be too complex — try a smaller image.");
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON. Please try again.");
  }

  const result = GenerateOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`AI response validation failed: ${issues}`);
  }

  if (validated.title) {
    result.data.title = validated.title;
  }
  if (validated.category) {
    result.data.category = validated.category;
  }

  return result.data;
}
