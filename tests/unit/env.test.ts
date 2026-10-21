import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { envCandidates, loadEnv, maskKey, NoKeyError, resolveProvider } from "../../src/core/env";

let base: string;
let repo: string;

beforeEach(() => {
  base = mkdtempSync(path.join(tmpdir(), "tenet-env-"));
  repo = path.join(base, "repo");
  mkdirSync(repo);
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("loadEnv", () => {
  it("prefers ./.env over ../.env", () => {
    writeFileSync(path.join(repo, ".env"), "PORTKEY_API_KEY=local-key\n");
    writeFileSync(path.join(base, ".env"), "PORTKEY_API_KEY=parent-key\n");
    const target: Record<string, string | undefined> = {};
    expect(loadEnv({ cwd: repo, target })).toBe(path.join(repo, ".env"));
    expect(target.PORTKEY_API_KEY).toBe("local-key");
  });

  it("uses ../.env when the repo folder has none", () => {
    writeFileSync(path.join(base, ".env"), "PORTKEY_API_KEY=parent-key\n");
    const target: Record<string, string | undefined> = {};
    expect(loadEnv({ cwd: repo, target })).toBe(path.join(base, ".env"));
    expect(target.PORTKEY_API_KEY).toBe("parent-key");
  });

  it("falls through to ../.env when ./.env has settings but no key", () => {
    writeFileSync(path.join(repo, ".env"), "TENET_CONCURRENCY=2\n");
    writeFileSync(path.join(base, ".env"), "OPENAI_API_KEY=parent-openai\n");
    const target: Record<string, string | undefined> = {};
    expect(loadEnv({ cwd: repo, target })).toBe(path.join(base, ".env"));
    expect(target.TENET_CONCURRENCY).toBe("2");
    expect(target.OPENAI_API_KEY).toBe("parent-openai");
  });

  it("never overrides variables that are already set", () => {
    writeFileSync(path.join(repo, ".env"), "PORTKEY_API_KEY=file-key\n");
    const target: Record<string, string | undefined> = { PORTKEY_API_KEY: "shell-key" };
    loadEnv({ cwd: repo, target });
    expect(target.PORTKEY_API_KEY).toBe("shell-key");
  });

  it("returns null when no file supplies a key", () => {
    expect(loadEnv({ cwd: repo, target: {} })).toBeNull();
  });

  it("computes Windows candidates with path.win32", () => {
    expect(envCandidates("C:\\Users\\staff\\tenet", path.win32)).toEqual([
      "C:\\Users\\staff\\tenet\\.env",
      "C:\\Users\\staff\\.env",
    ]);
  });
});

describe("resolveProvider", () => {
  it("auto picks Portkey, then OpenAI", () => {
    expect(resolveProvider({ PORTKEY_API_KEY: "a", OPENAI_API_KEY: "b" })).toBe("portkey");
    expect(resolveProvider({ OPENAI_API_KEY: "b" })).toBe("openai");
  });
  it("auto with no key is an error, never a silent mock", () => {
    expect(() => resolveProvider({})).toThrow(NoKeyError);
  });
  it("honors an explicit provider", () => {
    expect(resolveProvider({ TENET_PROVIDER: "mock" })).toBe("mock");
    expect(() => resolveProvider({ TENET_PROVIDER: "portkey" })).toThrow(NoKeyError);
    expect(() => resolveProvider({ TENET_PROVIDER: "bogus" })).toThrow(/Unknown/);
  });
});

describe("maskKey", () => {
  it("shows only the last four characters", () => {
    expect(maskKey("sk-abcdefgh1234")).toMatch(/^\*+1234$/);
    expect(maskKey(undefined)).toBeNull();
  });
});
