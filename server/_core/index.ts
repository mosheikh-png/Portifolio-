import "dotenv/config";
import express from "express";
import { createServer, type Server } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./serveStatic";
import { rateLimitLogin, rateLimitAI } from "./rateLimit";

const PORT_FALLBACK = 3000;
const PORT_RANGE = 20;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = PORT_FALLBACK): Promise<number> {
  for (let port = startPort; port < startPort + PORT_RANGE; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// --- Security Headers ---
function securityHeaders(_req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-XSS-Protection", "0");
  next();
}

// --- CORS ---
function getCorsOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.headers.origin;
  if (!origin) {
    return next();
  }

  const allowedOrigins = getCorsOrigins();
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}

// --- Request Logger ---
function requestLogger(req: express.Request, res: express.Response, next: express.NextFunction) {
  const start = Date.now();
  const { method, url } = req;
  const originalEnd = res.end;
  res.end = function (this: express.Response, ...args: any[]) {
    const duration = Date.now() - start;
    const status = res.statusCode;
    if (method === "OPTIONS") return originalEnd.apply(this, args as any);
    if (status >= 500) {
      console.error(`[Request] ${method} ${url} ${status} ${duration}ms`);
    } else if (status >= 400) {
      console.warn(`[Request] ${method} ${url} ${status} ${duration}ms`);
    }
    return originalEnd.apply(this, args as any);
  } as any;
  next();
}

let server: Server | null = null;
let isShuttingDown = false;

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Server] ${signal} received — shutting down gracefully`);

  if (server) {
    server.close(() => {
      console.log("[Server] HTTP server closed");
      process.exit(0);
    });
  }

  setTimeout(() => {
    console.error("[Server] Forced exit after timeout");
    process.exit(1);
  }, 10_000).unref();
}

async function startServer() {
  const app = express();
  server = createServer(app);

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Security
  app.use(securityHeaders);
  app.use(corsMiddleware);

  // Request logging
  app.use(requestLogger);

  // Health check (no auth, no rate limiting)
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Login rate limit (strict: 5 per 15min per IP)
  app.use("/api/auth/login", rateLimitLogin);

  // AI generation rate limit (10 per 10min per IP)
  app.use("/api/trpc/cms.generateProjectContent", rateLimitAI);

  // Routes
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Static files or Vite dev server
  if (process.env.NODE_ENV === "development") {
    const viteModulePath = "./vite";
    const { setupVite } = await import(viteModulePath);
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || String(PORT_FALLBACK));
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`[Server] Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${port}/`);
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
