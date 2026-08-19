import crypto from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const BUILT_IN_APP_ID = "built-in";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = (req.body ?? {}) as Record<string, unknown>;

    if (typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      console.error("[Auth] ADMIN_USERNAME or ADMIN_PASSWORD not configured");
      res.status(500).json({ error: "Admin login is not configured" });
      return;
    }

    const usernameOk = username.length === adminUsername.length && timingSafeEqual(username, adminUsername);
    const passwordOk = password.length === adminPassword.length && timingSafeEqual(password, adminPassword);

    if (!usernameOk || !passwordOk) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    try {
      const openId = `admin-${adminUsername}`;

      await db.upsertUser({
        openId,
        name: adminUsername,
        email: null,
        loginMethod: "built-in",
        role: "admin",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.signSession(
        { openId, appId: BUILT_IN_APP_ID, name: adminUsername },
        { expiresInMs: ONE_YEAR_MS },
      );

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
}
