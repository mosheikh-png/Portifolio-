import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.hoisted(() => {
  process.env.AI_PROVIDER = "gemini";
  process.env.AI_API_KEY = "test-api-key-12345";
  process.env.AI_MODEL = "gemini-3.6-flash";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = "test-assets";
});

vi.mock("fs/promises", () => ({
  default: { readFile: mockReadFile },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

import { generateProjectContent } from "./_core/ai";

const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

const VALID_RESULT = JSON.stringify({
  candidates: [{ content: { parts: [{ text: JSON.stringify({
    title: "Social Media Design",
    titleAr: null,
    category: "Social Media",
    summary: "A professional social media design with strong visual hierarchy.",
    summaryAr: null,
    projectUrl: null,
  }) }], finishReason: "STOP" } }],
});

const VALID_INPUT = {
  imageUrl: "/manus-storage/portfolio/1/projects/design.png",
  language: "en" as const,
  category: "Social Media",
};

function makeResponse(status: number, body: string, contentType = "application/json") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 400 ? "Bad Request" : status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : status === 404 ? "Not Found" : status === 429 ? "Too Many Requests" : status === 500 ? "Internal Server Error" : "Error",
    headers: { get: (name: string) => name === "content-type" ? contentType : null },
    text: () => Promise.resolve(body),
  };
}

describe("Gemini HTTP response handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(MINIMAL_PNG);
  });

  it("200 + valid JSON → success", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, VALID_RESULT));
    const result = await generateProjectContent(VALID_INPUT);
    expect(result.title).toBe("Social Media Design");
    expect(result.category).toBe("Social Media");
  });

  it("200 + malformed generated JSON → 'malformed JSON'", async () => {
    const body = JSON.stringify({
      candidates: [{ content: { parts: [{ text: "not valid json" }], finishReason: "STOP" } }],
    });
    mockFetch.mockResolvedValueOnce(makeResponse(200, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("AI returned malformed JSON");
  });

  it("401 → authentication failed", async () => {
    const body = JSON.stringify({ error: { code: 401, message: "Invalid API key", status: "UNAUTHENTICATED" } });
    mockFetch.mockResolvedValueOnce(makeResponse(401, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini API authentication failed");
  });

  it("403 → authentication failed", async () => {
    const body = JSON.stringify({ error: { code: 403, message: "Forbidden", status: "PERMISSION_DENIED" } });
    mockFetch.mockResolvedValueOnce(makeResponse(403, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini API authentication failed");
  });

  it("404 → model not found", async () => {
    const body = JSON.stringify({ error: { code: 404, message: "models/gemini-3.6-flash is not found", status: "NOT_FOUND" } });
    mockFetch.mockResolvedValueOnce(makeResponse(404, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini model or API endpoint not found");
  });

  it("429 → quota exceeded", async () => {
    const body = JSON.stringify({ error: { code: 429, message: "Rate limit exceeded", status: "RESOURCE_EXHAUSTED" } });
    mockFetch.mockResolvedValueOnce(makeResponse(429, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini quota/rate limit exceeded");
  });

  it("500 → service unavailable", async () => {
    const body = JSON.stringify({ error: { code: 500, message: "Internal Server Error", status: "INTERNAL" } });
    mockFetch.mockResolvedValueOnce(makeResponse(500, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini service is temporarily unavailable");
  });

  it("HTML response with text/html content-type → 'unexpected HTML response'", async () => {
    const html = "<!DOCTYPE html><html><head><title>Not Found</title></head><body>Not Found</body></html>";
    mockFetch.mockResolvedValueOnce(makeResponse(200, html, "text/html; charset=utf-8"));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini returned an unexpected HTML response");
  });

  it("404 with HTML error page → 'model not found'", async () => {
    const html = "<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>";
    mockFetch.mockResolvedValueOnce(makeResponse(404, html, "text/html; charset=utf-8"));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini model or API endpoint not found");
  });

  it("400 with HTML error page → 'unexpected HTML error page'", async () => {
    const html = "<!DOCTYPE html><html><body><h1>Bad Request</h1></body></html>";
    mockFetch.mockResolvedValueOnce(makeResponse(400, html, "text/html; charset=utf-8"));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini returned an unexpected HTML error page");
  });

  it("empty body → 'invalid JSON response'", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, "", "application/json"));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini returned an invalid JSON response");
  });

  it("missing candidates → 'empty content'", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, "{}", "application/json"));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("AI returned empty content");
  });

  it("empty parts array → 'empty content'", async () => {
    const body = JSON.stringify({
      candidates: [{ content: { parts: [] }, finishReason: "STOP" }],
    });
    mockFetch.mockResolvedValueOnce(makeResponse(200, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("AI returned empty content");
  });

  it("SAFETY finishReason → 'blocked by safety filters'", async () => {
    const body = JSON.stringify({
      candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }],
    });
    mockFetch.mockResolvedValueOnce(makeResponse(200, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("blocked by safety filters");
  });

  it("fetch network error → 'Failed to connect'", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Failed to connect to Gemini API");
  });

  it("fetch timeout → 'timed out'", async () => {
    const timeoutErr = new Error("The operation was aborted");
    timeoutErr.name = "TimeoutError";
    mockFetch.mockRejectedValueOnce(timeoutErr);
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("AI generation timed out");
  });
});
