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
const MAX_OUTPUT_TOKENS = 4096;
const RETRY_DELAY_MS = 3000;
const MAX_RETRY_AFTER_MS = 10_000;

class TransientAIError extends Error {
  constructor(message: string, public status: number, public retryAfterMs?: number) {
    super(message);
    this.name = "TransientAIError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    "Social Media": `Analyze: format, visual concept, composition, typography, color palette, graphic elements, and brand consistency.`,
    "Photo Manipulation": `Analyze: compositing technique, subject, lighting, color grading, manipulation techniques, and visual narrative.`,
    "Book Cover": `Analyze: genre indicators, typography, illustration, layout hierarchy, color mood, and market positioning.`,
    "PowerPoint Presentation": `Analyze: slide layout, typography, color system, data visualization, visual consistency, and template design.`,
    "Photo Retouching": `Analyze: skin treatment, color correction, lighting, detail work, beauty/fashion context, and professional finish.`,
    "YouTube Thumbnail": `Analyze: visual impact, face prominence, text overlay, color contrast, emotional hook, and composition.`,
  };
  return guideMap[category] || `Analyze: visual subject, composition, typography, color, hierarchy, and style.`;
}

// --- System prompt ---

function buildSystemPrompt(language: string): string {
  const langInstruction = language === "ar"
    ? "Write the summary and titleAr fields in natural, professional Arabic. Do not use literal machine translation."
    : "Write in English. For titleAr and summaryAr, provide natural Arabic translations only if clearly appropriate; otherwise set them to null.";

  return `You are a professional art-director and portfolio writer for graphic designer Mohamed Adel.

Your task: analyze the uploaded design image and generate portfolio project content.

RULES:
- Analyze ONLY what is visible in the image
- NEVER invent client names, brands, awards, statistics, dates, or business outcomes
- NEVER use filler words unless the image genuinely supports them
- Write like a designer presenting art direction — technical, specific, visual
- Category must match exactly one of the provided options
- Return concise portfolio content. Do not write long essays.

LANGUAGE:
${langInstruction}

For the summary field: write 2-3 concise sentences covering visual concept, composition, typography, color, and technique.`;
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

// --- Gemini REST API response schema (no nullable — all STRING fields) ---

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "Short portfolio-appropriate title in English, 5-8 words" },
    titleAr: { type: "STRING", description: "Project title in natural professional Arabic, or empty string if unavailable" },
    category: { type: "STRING", description: "Exact category from the provided list" },
    summary: { type: "STRING", description: "Professional art-direction description, 3-5 sentences" },
    summaryAr: { type: "STRING", description: "Arabic version of the summary, or empty string if unavailable" },
    projectUrl: { type: "STRING", description: "Always empty string" },
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

// --- Gemini API call (single attempt) ---

async function callGeminiOnce(
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
    let errorCode: string | undefined;
    try {
      const errorData = JSON.parse(rawBody);
      if (errorData?.error?.message) {
        errorMsg = errorData.error.message;
      }
      if (errorData?.error?.status) {
        errorCode = errorData.error.status;
      }
    } catch {
      if (rawBody.startsWith("<!DOCTYPE") || rawBody.startsWith("<html")) {
        console.error(`[AI] Gemini returned HTML error page. First 200 chars: ${rawBody.substring(0, 200)}`);
        errorMsg = "Gemini returned an unexpected HTML error page.";
      }
    }

    // Log safe diagnostics for ALL non-2xx responses
    console.error(`[AI] Gemini HTTP error: status=${response.status} statusText=${response.statusText} providerMsg=${errorMsg} providerCode=${errorCode || "none"} model=${AI_MODEL}`);

    if (response.status === 401 || response.status === 403) {
      throw new Error("Gemini API authentication failed.");
    }
    if (response.status === 404) {
      throw new Error(`Gemini model or endpoint not found (${AI_MODEL}).`);
    }
    if (response.status === 400) {
      throw new Error(`Gemini rejected the request: ${errorMsg}`);
    }
    if (response.status === 429) {
      // Parse Retry-After header (seconds or HTTP-date)
      const retryAfterHeader = response.headers.get("retry-after");
      let retryAfterMs: number | undefined;
      if (retryAfterHeader) {
        const seconds = parseInt(retryAfterHeader, 10);
        if (!isNaN(seconds)) {
          retryAfterMs = Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
        }
      }
      throw new TransientAIError("Gemini quota or rate limit exceeded.", 429, retryAfterMs);
    }
    if (response.status >= 500) {
      const retryAfterHeader = response.headers.get("retry-after");
      let retryAfterMs: number | undefined;
      if (retryAfterHeader) {
        const seconds = parseInt(retryAfterHeader, 10);
        if (!isNaN(seconds)) {
          retryAfterMs = Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
        }
      }
      throw new TransientAIError(`Gemini service error (${response.status}): ${errorMsg}`, response.status, retryAfterMs);
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
  const finishReason = data?.candidates?.[0]?.finishReason;
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  console.log(`[AI] Gemini finishReason=${finishReason || "none"} textLength=${content?.length || 0}`);

  if (!content || typeof content !== "string") {
    if (finishReason === "SAFETY") {
      throw new Error("AI generation was blocked by safety filters. Try a different image.");
    }
    if (finishReason === "MAX_TOKENS") {
      throw new Error("AI generation reached the output limit. Please generate again.");
    }
    throw new Error("AI returned empty content. The image may be unsupported or too large.");
  }

  // Check for truncation — if finishReason is MAX_TOKENS, the JSON is incomplete
  if (finishReason === "MAX_TOKENS") {
    throw new Error("AI generation was truncated. Please generate again.");
  }

  console.log(`[AI] Gemini text first 300 chars: ${content.substring(0, 300)}`);

  return content;
}

// --- Gemini API call with single retry for transient errors ---

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  imageData?: { base64: string; mimeType: string },
): Promise<string> {
  try {
    return await callGeminiOnce(systemPrompt, userPrompt, imageData);
  } catch (err) {
    if (err instanceof TransientAIError) {
      const delay = err.retryAfterMs ?? RETRY_DELAY_MS;
      console.log(`[AI] Gemini transient error: ${err.status}`);
      console.log(`[AI] Retrying once in ${delay}ms`);
      await sleep(delay);
      try {
        const result = await callGeminiOnce(systemPrompt, userPrompt, imageData);
        console.log(`[AI] Gemini retry result: status=200`);
        return result;
      } catch (retryErr) {
        if (retryErr instanceof TransientAIError) {
          console.error(`[AI] Gemini retry also failed: ${retryErr.status}`);
          throw new Error("خدمة الذكاء الاصطناعي مشغولة حاليًا. حاول مرة أخرى بعد قليل.");
        }
        throw retryErr;
      }
    }
    throw err;
  }
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

    // Strip markdown code fences if present
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();

    // Strip any leading/trailing non-JSON text (e.g. "Here is the JSON:")
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    parsed = JSON.parse(cleaned);
  } catch (e: any) {
    console.error(`[AI] JSON parse failed. Raw text first 300 chars: ${raw.substring(0, 300)}`);
    throw new Error(`AI returned malformed JSON. ${e?.message || "Parse error"}`);
  }

  const result = GenerateOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`AI response structure is invalid: ${issues}`);
  }

  // Convert empty strings to null for nullable fields
  if (result.data.titleAr === "") result.data.titleAr = null;
  if (result.data.summaryAr === "") result.data.summaryAr = null;
  if (result.data.projectUrl === "") result.data.projectUrl = null;

  if (validated.title) {
    result.data.title = validated.title;
  }
  if (validated.category) {
    result.data.category = validated.category;
  }

  return result.data;
}
