/**
 * AI Content Generation Provider
 *
 * Server-side only. Uses an OpenAI-compatible API.
 * Configured via environment variables:
 *   AI_PROVIDER  — "openai" | "openai-compatible" (default: none)
 *   AI_API_KEY   — API key for the provider
 *   AI_MODEL     — Model name (default: "gpt-4o-mini")
 *   AI_BASE_URL  — Base URL for OpenAI-compatible providers (optional)
 */

import { z } from "zod";

const AI_PROVIDER = process.env.AI_PROVIDER ?? "";
const AI_API_KEY = process.env.AI_API_KEY ?? "";
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";
const AI_BASE_URL = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";

export function isAIConfigured(): boolean {
  return Boolean(AI_PROVIDER && AI_API_KEY);
}

// --- Input schema (what the admin provides) ---

const GenerateInputSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  category: z.string().min(1).max(140).optional(),
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
const AI_TIMEOUT_MS = 30_000;
const MAX_TOKENS = 1200;

// --- System prompt ---

const SYSTEM_PROMPT = `You are a professional portfolio content writer for a graphic designer named Mohamed Adel.

Your task: generate project content for a graphic design portfolio.

Rules:
- Write in a concise, professional, editorial tone
- Do NOT invent statistics, awards, clients, testimonials, or business outcomes
- Do NOT invent specific technologies or tools not provided by the admin
- If information is unavailable, use neutral wording or leave the field as null
- Titles should be short, punchy, and portfolio-appropriate (5-8 words max)
- Summaries should be 2-3 sentences describing what the project is about
- Arabic content should be natural, professional Arabic — not a machine translation
- Category must match exactly one of the provided category options
- Output ONLY valid JSON matching the schema provided
- Never include markdown, code fences, or commentary outside the JSON`;

// --- User prompt builder ---

function buildUserPrompt(input: GenerateInput): string {
  const parts: string[] = [];

  if (input.title) parts.push(`Project title: ${input.title}`);
  if (input.category) parts.push(`Category: ${input.category}`);
  if (input.client) parts.push(`Client: ${input.client}`);
  if (input.tools) parts.push(`Tools/technologies: ${input.tools}`);
  if (input.summary) parts.push(`Admin summary: ${input.summary}`);
  if (input.adminDescription) parts.push(`Additional notes from admin: ${input.adminDescription}`);

  const categoryList = VALID_CATEGORIES.join(", ");

  return `Generate portfolio project content based on the following information:

${parts.length > 0 ? parts.join("\n") : "No additional information provided — create content based on the category only."}

Valid categories (pick the closest match): ${categoryList}

Return a JSON object with exactly these fields:
{
  "title": "Project title in English (short, editorial, 5-8 words)",
  "titleAr": "Project title in Arabic (natural, professional) or null if unclear",
  "category": "One of: ${categoryList}",
  "summary": "2-3 sentence project description in English, professional and concise",
  "summaryAr": "2-3 sentence project description in Arabic, or null if unclear",
  "projectUrl": null
}`;
}

// --- Main generation function ---

export async function generateProjectContent(input: GenerateInput): Promise<GenerateOutput> {
  if (!isAIConfigured()) {
    throw new Error("AI is not configured. Set AI_PROVIDER and AI_API_KEY environment variables.");
  }

  const validated = GenerateInputSchema.parse(input);

  // Guard against excessively long input
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

  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(validated) },
      ],
      temperature: 0.7,
      max_tokens: MAX_TOKENS,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`AI provider returned ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("AI provider returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI provider returned invalid JSON");
  }

  const result = GenerateOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join("; ");
    throw new Error(`AI output validation failed: ${issues}`);
  }

  return result.data;
}
