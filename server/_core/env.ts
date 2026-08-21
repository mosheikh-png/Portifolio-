import crypto from "crypto";

if (!process.env.STORAGE_DRIVER) {
  process.env.STORAGE_DRIVER = "local";
}

const isProduction = process.env.NODE_ENV === "production";

function getCookieSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret && secret.length >= 16) {
    return secret;
  }

  if (isProduction) {
    console.error("[Env] FATAL: JWT_SECRET must be set in production (minimum 16 characters).");
    console.error("[Env] Set the JWT_SECRET environment variable and restart.");
    process.exit(1);
  }

  if (!secret) {
    const fallbackSecret = crypto.randomBytes(32).toString("base64");
    console.warn("[Env] JWT_SECRET not set — using random session secret (sessions reset on restart)");
    return fallbackSecret;
  }

  console.warn("[Env] JWT_SECRET is shorter than 16 characters. Using it anyway in development.");
  return secret;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: getCookieSecret(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
