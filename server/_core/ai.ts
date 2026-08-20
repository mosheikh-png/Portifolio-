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

// --- Input schema ---

const GenerateInputSchema = z.object({
  title: z.string().max(180).optional(),
  category: z.string().max(140).optional(),
  summary: z.string().max(6000).optional(),
  tools: z.string().max(500).optional(),
  client: z.string().max(200).optional(),
  adminDescription: z.string().max(4000).optional(),
});

export type GenerateInput = z.infer<typeof GenerateInputSchema>;

// --- Output schema (validated) ---

const GenerateOutputSchema = z.object({
  title: z.string().max(180),
  titleAr: z.string().max(180).nullable(),
  category: z.string().max(140),
  summary: z.string().max(6000),
  summaryAr: z.string().max(6000).nullable(),
  projectUrl: z.string().max(512).nullable(),
});

export type GenerateOutput = z.infer<typeof GenerateOutputSchema>;

// --- Provider call ---

const SYSTEM_PROMPT = `You are a portfolio content writer for a graphic designer named Mohamed Adel.
Generate project content in both English and Arabic.
Output ONLY valid JSON matching the provided schema.
Do NOT invent statistics, awards, clients, testimonials, or technologies not provided.
If information is unknown, use neutral wording or leave the field as null.
Be concise, professional, and editorial in tone.`;

function buildUserPrompt(input: GenerateInput): string {
  const parts: string[] = [];
  if (input.title) parts.push(`Project title: ${input.title}`);
  if (input.category) parts.push(`Category: ${input.category}`);
  if (input.client) parts.push(`Client: ${input.client}`);
  if (input.tools) parts.push(`Tools/technologies: ${input.tools}`);
  if (input.summary) parts.push(`Admin summary/description: ${input.summary}`);
  if (input.adminDescription) parts.push(`Additional notes: ${input.adminDescription}`);

  return `Generate portfolio project content based on the following information:

${parts.length > 0 ? parts.join("\n") : "No additional information provided — create content based on the category only."}

Return a JSON object with exactly these fields:
{
  "title": "Project title in English (short, editorial)",
  "titleAr": "Project title in Arabic or null",
  "category": "Category matching one of: ${input.category || 'Social Media, Branding, Print, Motion Graphics, UI/UX, Packaging, Photography, Other'}",
  "summary": "2-3 sentence project description in English",
  "summaryAr": "2-3 sentence project description in Arabic or null",
  "projectUrl": "null (placeholder)"
}`;
}

export async function generateProjectContent(input: GenerateInput): Promise<GenerateOutput> {
  if (!isAIConfigured()) {
    throw new Error("AI is not configured. Set AI_PROVIDER and AI_API_KEY environment variables.");
  }

  const validated = GenerateInputSchema.parse(input);

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
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30_000),
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
    throw new Error(`AI output validation failed: ${result.error.issues.map(i => i.message).join(", ")}`);
  }

  return result.data;
}
