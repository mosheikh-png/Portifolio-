import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private windows = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly max: number;

  constructor(windowMs: number, max: number) {
    this.windowMs = windowMs;
    this.max = max;

    setInterval(() => this.cleanup(), windowMs);
  }

  private cleanup() {
    const now = Date.now();
    const entries = Array.from(this.windows.entries());
    for (const [key, entry] of entries) {
      if (now >= entry.resetAt) {
        this.windows.delete(key);
      }
    }
  }

  consume(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now >= entry.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }

    entry.count++;
    if (entry.count > this.max) {
      return { allowed: false, retryAfterMs: entry.resetAt - now };
    }

    return { allowed: true, retryAfterMs: 0 };
  }
}

function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff)) {
    return xff[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

// Login: 5 attempts per 15 minutes per IP
const loginLimiter = new RateLimiter(15 * 60 * 1000, 5);

// AI generation: 10 requests per 10 minutes per IP (cost-sensitive)
const aiLimiter = new RateLimiter(10 * 60 * 1000, 10);

// General admin mutations: 120 requests per 5 minutes per IP
const adminLimiter = new RateLimiter(5 * 60 * 1000, 120);

export function rateLimitLogin(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const result = loginLimiter.consume(`login:${ip}`);

  if (!result.allowed) {
    const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({ error: "Too many login attempts. Please try again later." });
    return;
  }

  next();
}

export function rateLimitAI(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const result = aiLimiter.consume(`ai:${ip}`);

  if (!result.allowed) {
    const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({ error: "AI generation rate limit exceeded. Please try again later." });
    return;
  }

  next();
}

export function rateLimitAdmin(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const result = adminLimiter.consume(`admin:${ip}`);

  if (!result.allowed) {
    const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return;
  }

  next();
}
