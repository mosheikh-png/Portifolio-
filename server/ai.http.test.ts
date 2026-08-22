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

function makeResponse(status: number, body: string, contentType = "application/json", headers: Record<string, string> = {}) {
  const allHeaders: Record<string, string> = { "content-type": contentType, ...headers };
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 400 ? "Bad Request" : status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : status === 404 ? "Not Found" : status === 429 ? "Too Many Requests" : status === 500 ? "Internal Server Error" : status === 503 ? "Service Unavailable" : "Error",
    headers: { get: (name: string) => allHeaders[name] ?? null },
    text: () => Promise.resolve(body),
  };
}

function errorBody(status: number, message: string, code: string) {
  return JSON.stringify({ error: { code, message, status: code } });
}

describe("Gemini HTTP response handling", () => {
  beforeEach(() => {
    mockFetch.mockReset();
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

  it("401 → authentication failed (no retry)", async () => {
    const body = errorBody(401, "Invalid API key", "UNAUTHENTICATED");
    mockFetch.mockResolvedValueOnce(makeResponse(401, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini API authentication failed");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("403 → authentication failed (no retry)", async () => {
    const body = errorBody(403, "Forbidden", "PERMISSION_DENIED");
    mockFetch.mockResolvedValueOnce(makeResponse(403, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini API authentication failed");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("404 → model not found (no retry)", async () => {
    const body = errorBody(404, "models/gemini-3.6-flash is not found", "NOT_FOUND");
    mockFetch.mockResolvedValueOnce(makeResponse(404, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini model or endpoint not found");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("400 → request rejected (no retry)", async () => {
    const body = errorBody(400, "Invalid request body", "INVALID_ARGUMENT");
    mockFetch.mockResolvedValueOnce(makeResponse(400, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini rejected the request");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("429 → retry → 200 = PASS", async () => {
    const retryBody = errorBody(429, "Rate limit exceeded", "RESOURCE_EXHAUSTED");
    mockFetch
      .mockResolvedValueOnce(makeResponse(429, retryBody))
      .mockResolvedValueOnce(makeResponse(200, VALID_RESULT));
    const result = await generateProjectContent(VALID_INPUT);
    expect(result.title).toBe("Social Media Design");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("429 → retry → 429 = Arabic temporary-unavailable error", async () => {
    const retryBody = errorBody(429, "Rate limit exceeded", "RESOURCE_EXHAUSTED");
    mockFetch
      .mockResolvedValueOnce(makeResponse(429, retryBody))
      .mockResolvedValueOnce(makeResponse(429, retryBody));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("خدمة الذكاء الاصطناعي مشغولة حاليًا");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("429 with Retry-After header → uses header delay (capped)", async () => {
    const retryBody = errorBody(429, "Rate limit exceeded", "RESOURCE_EXHAUSTED");
    mockFetch
      .mockResolvedValueOnce(makeResponse(429, retryBody, "application/json", { "retry-after": "1" }))
      .mockResolvedValueOnce(makeResponse(200, VALID_RESULT));
    const result = await generateProjectContent(VALID_INPUT);
    expect(result.title).toBe("Social Media Design");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("500 → retry → 200 = PASS", async () => {
    const retryBody = errorBody(500, "Internal error", "INTERNAL");
    mockFetch
      .mockResolvedValueOnce(makeResponse(500, retryBody))
      .mockResolvedValueOnce(makeResponse(200, VALID_RESULT));
    const result = await generateProjectContent(VALID_INPUT);
    expect(result.title).toBe("Social Media Design");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("500 → retry → 500 = Arabic temporary-unavailable error", async () => {
    const retryBody = errorBody(500, "Internal error", "INTERNAL");
    mockFetch
      .mockResolvedValueOnce(makeResponse(500, retryBody))
      .mockResolvedValueOnce(makeResponse(500, retryBody));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("خدمة الذكاء الاصطناعي مشغولة حاليًا");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("503 → retry → 200 = PASS", async () => {
    const retryBody = errorBody(503, "Service Unavailable", "UNAVAILABLE");
    mockFetch
      .mockResolvedValueOnce(makeResponse(503, retryBody))
      .mockResolvedValueOnce(makeResponse(200, VALID_RESULT));
    const result = await generateProjectContent(VALID_INPUT);
    expect(result.title).toBe("Social Media Design");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("503 → retry → 503 = Arabic temporary-unavailable error", async () => {
    const retryBody = errorBody(503, "Service Unavailable", "UNAVAILABLE");
    mockFetch
      .mockResolvedValueOnce(makeResponse(503, retryBody))
      .mockResolvedValueOnce(makeResponse(503, retryBody));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("خدمة الذكاء الاصطناعي مشغولة حاليًا");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("504 → retry → 200 = PASS", async () => {
    const retryBody = errorBody(504, "Gateway Timeout", "DEADLINE_EXCEEDED");
    mockFetch
      .mockResolvedValueOnce(makeResponse(504, retryBody))
      .mockResolvedValueOnce(makeResponse(200, VALID_RESULT));
    const result = await generateProjectContent(VALID_INPUT);
    expect(result.title).toBe("Social Media Design");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("HTML response with text/html content-type → 'unexpected HTML response'", async () => {
    const html = "<!DOCTYPE html><html><head><title>Not Found</title></head><body>Not Found</body></html>";
    mockFetch.mockResolvedValueOnce(makeResponse(200, html, "text/html; charset=utf-8"));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini returned an unexpected HTML response");
  });

  it("404 with HTML error page → 'model not found'", async () => {
    const html = "<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>";
    mockFetch.mockResolvedValueOnce(makeResponse(404, html, "text/html; charset=utf-8"));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Gemini model or endpoint not found");
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

  it("MAX_TOKENS finishReason with empty content → 'reached the output limit'", async () => {
    const body = JSON.stringify({
      candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }],
    });
    mockFetch.mockResolvedValueOnce(makeResponse(200, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("reached the output limit");
  });

  it("MAX_TOKENS finishReason with partial content → 'truncated'", async () => {
    const partial = '{"title":"My Design","titleAr":"","category":"Social Media","summary":"A social';
    const body = JSON.stringify({
      candidates: [{ content: { parts: [{ text: partial }] }, finishReason: "MAX_TOKENS" }],
    });
    mockFetch.mockResolvedValueOnce(makeResponse(200, body));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("truncated");
  });

  it("complete JSON with STOP finishReason → PASS", async () => {
    const complete = JSON.stringify({
      title: "Creative Social Media Post",
      titleAr: null,
      category: "Social Media",
      summary: "A vibrant social media design.",
      summaryAr: null,
      projectUrl: null,
    });
    const body = JSON.stringify({
      candidates: [{ content: { parts: [{ text: complete }] }, finishReason: "STOP" }],
    });
    mockFetch.mockResolvedValueOnce(makeResponse(200, body));
    const result = await generateProjectContent(VALID_INPUT);
    expect(result.title).toBe("Creative Social Media Post");
    expect(result.category).toBe("Social Media");
  });

  it("fetch network error → 'Failed to connect' (no retry)", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("Failed to connect to Gemini API");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fetch timeout → 'timed out' (no retry)", async () => {
    const timeoutErr = new Error("The operation was aborted");
    timeoutErr.name = "TimeoutError";
    mockFetch.mockRejectedValueOnce(timeoutErr);
    await expect(generateProjectContent(VALID_INPUT)).rejects.toThrow("AI generation timed out");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
