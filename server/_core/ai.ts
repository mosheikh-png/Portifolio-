/**
 * AI Content Generation Provider — Gemini Vision
 *
 * Server-side only. Uses the Google Gemini API for image-aware portfolio content generation.
 * Configured via environment variables:
 *   AI_PROVIDER  — "gemini" (required)
 *   AI_API_KEY   — Google Gemini API key
 *   AI_MODEL     — Gemini model (default: "gemini-3.6-flash")
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
const AI_MODEL = process.env.AI_MODEL ?? "gemini-3.6-flash";
const AI_BASE_URL = (process.env.AI_BASE_URL ?? "https://generativelanguage.googleapis.com").replace(/\/+$/, "");

export function isAIConfigured(): boolean {
  return Boolean(AI_PROVIDER && AI_API_KEY);
}

// --- Startup config logging (model only, never log API key) ---

if (isAIConfigured()) {
  console.log(`[AI] Provider: ${AI_PROVIDER}`);
  console.log(`[AI] Model: ${AI_MODEL}`);
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
- titleAr and summaryAr: provide natural Arabic only if clearly appropriate, otherwise null

LANGUAGE:
${langInstruction}

For the summary field: write a professional art-direction description (3-5 sentences) covering visual concept, composition, typography, color, technique, and design rationale. Write like a design case-study paragraph — specific to what you see in the image.`;
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

// --- Gemini REST API response schema (protobuf-compatible per Gemini 3.x REST spec) ---

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "Short portfolio-appropriate title in English, 5-8 words" },
    titleAr: { type: "STRING", nullable: true, description: "Project title in natural professional Arabic, or empty string if unavailable" },
    category: { type: "STRING", description: "Exact category from the provided list" },
    summary: { type: "STRING", description: "Professional art-direction description, 3-5 sentences" },
    summaryAr: { type: "STRING", nullable: true, description: "Arabic version of the summary, or empty string if unavailable" },
    projectUrl: { type: "STRING", nullable: true, description: "Always empty string" },
  },
  required: ["title", "titleAr", "category", "summary", "summaryAr", "projectUrl"],
};

// --- Validate schema has no array-valued type fields (protobuf incompatibility) ---

function validateGeminiSchema(obj: Record<string, unknown>, path = "schema"): void {
  for (const [key, value] of Object.entries(obj)) {
    if (key === "type" && Array.isArray(value)) {
      throw new Error(`[AI] Schema error: array-valued "type" at "${path}" — not accepted by Gemini REST API`);
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      validateGeminiSchema(value as Record<string, unknown>, `${path}.${key}`);
    }
  }
}

validateGeminiSchema(GEMINI_RESPONSE_SCHEMA);
console.log("[AI] Gemini schema validated locally — no array-valued type fields");

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

  // Step 1: Send request (handle connection/timeout errors)
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.code === "ABORT_ERR") {
      throw new Error("AI generation timed out. The image may be too complex — try a smaller image.");
    }
    throw new Error(`Failed to connect to Gemini API: ${err?.message || "unknown error"}`);
  }

  // Step 2: Read body as text ONCE (never call response.json() on unknown content)
  let rawBody: string;
  try {
    rawBody = await response.text();
  } catch {
    throw new Error("Failed to read Gemini API response body.");
  }

  const contentType = response.headers.get("content-type") || "unknown";

  // Step 3: Diagnostic logging (never log API key or full response)
  console.log(`[AI] Gemini response: status=${response.status} contentType=${contentType} model=${AI_MODEL}`);

  // Step 4: Non-2xx — parse provider error safely
  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errorData = JSON.parse(rawBody);
      if (errorData?.error?.message) {
        errorMsg = errorData.error.message;
      }
    } catch {
      if (rawBody.startsWith("<!DOCTYPE") || rawBody.startsWith("<html")) {
        console.error(`[AI] Gemini returned HTML error page. First 200 chars: ${rawBody.substring(0, 200)}`);
        errorMsg = "Gemini returned an unexpected HTML error page.";
      }
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("Gemini API authentication failed. Check AI_API_KEY.");
    }
    if (response.status === 404) {
      throw new Error(`Gemini model or API endpoint not found (${AI_MODEL}). Check AI_MODEL and Gemini API configuration.`);
    }
    if (response.status === 429) {
      throw new Error("Gemini quota/rate limit exceeded.");
    }
    if (response.status >= 500) {
      throw new Error("Gemini service is temporarily unavailable.");
    }
    throw new Error(`Gemini API error (${response.status}): ${errorMsg}`);
  }

  // Step 5: 2xx — detect HTML before parsing JSON
  if (contentType.includes("text/html") || rawBody.startsWith("<!DOCTYPE") || rawBody.startsWith("<html")) {
    console.error(`[AI] Gemini returned HTML instead of JSON. First 200 chars: ${rawBody.substring(0, 200)}`);
    throw new Error("Gemini returned an unexpected HTML response. Check the Gemini API endpoint/configuration.");
  }

  // Step 6: Parse JSON response
  let data: GeminiResponse;
  try {
    data = JSON.parse(rawBody);
  } catch {
    console.error(`[AI] Failed to parse Gemini JSON response. First 200 chars: ${rawBody.substring(0, 200)}`);
    throw new Error("Gemini returned an invalid JSON response.");
  }

  // Step 7: Extract generated text from candidates
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content || typeof content !== "string") {
    if (data?.candidates?.[0]?.finishReason === "SAFETY") {
      throw new Error("AI generation was blocked by safety filters. Try a different image.");
    }
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
    let cleaned = raw.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    parsed = JSON.parse(cleaned);
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
