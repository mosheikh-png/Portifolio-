import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { storagePut } from "./storage";

let temporaryDirectory = "";

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = "";
  delete process.env.STORAGE_DRIVER;
  delete process.env.LOCAL_STORAGE_DIR;
});

describe("local storage handover mode", () => {
  it("writes uploads inside the configured local asset directory", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-storage-"));
    process.env.STORAGE_DRIVER = "local";
    process.env.LOCAL_STORAGE_DIR = temporaryDirectory;

    const result = await storagePut("portfolio/demo.txt", "portable", "text/plain");
    const savedContent = await readFile(path.join(temporaryDirectory, result.key), "utf8");

    expect(result.url).toBe(`/manus-storage/${result.key}`);
    expect(result.key).toMatch(/^portfolio\/demo_[a-f0-9]{8}\.txt$/);
    expect(savedContent).toBe("portable");
  });

  it("rejects traversal-like storage keys", async () => {
    process.env.STORAGE_DRIVER = "local";
    process.env.LOCAL_STORAGE_DIR = await mkdtemp(path.join(os.tmpdir(), "portfolio-storage-"));
    temporaryDirectory = process.env.LOCAL_STORAGE_DIR;

    await expect(storagePut("../outside.txt", "blocked")).rejects.toThrow("Storage key must be a non-empty relative path");
  });
});
