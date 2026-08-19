import crypto from "crypto";

if (!process.env.STORAGE_DRIVER) {
  process.env.STORAGE_DRIVER = "local";
}

// Generate a secure random fallback when JWT_SECRET is not provided.
// Sessions won't survive container restarts without a persistent secret,
// but login will work immediately without manual env configuration.
const fallbackSecret = crypto.randomBytes(32).toString("base64");
const cookieSecret = process.env.JWT_SECRET || fallbackSecret;

if (!process.env.JWT_SECRET) {
  console.warn("[Env] JWT_SECRET not set — using random session secret (sessions reset on restart)");
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
