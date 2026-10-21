import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createCapabilityResolver } from "../../src/core/model/capabilities";
import { createModelClient, extractJson, type ModelDeps } from "../../src/core/model/client";
import { mockProvider } from "../../src/core/model/providers/mock";
import {
  ModelCallFailed,
  NoMockHandler,
  ProviderError,
  SchemaInvalid,
  type Provider,
  type ProviderRequest,
  type ProviderResponse,
} from "../../src/core/model/types";
import { BudgetExceeded, Ledger } from "../../src/core/pipeline/budget";
import { MOCK_CAPABILITIES, type Capabilities } from "../../src/core/schemas/capabilities";
import type { UsageEvent } from "../../src/core/schemas/records";

type Step = Partial<ProviderResponse> | ProviderError;

function reply(text: string, extra: Partial<ProviderResponse> = {}): Partial<ProviderResponse> {
  return { text, ...extra };
}

function fakeProvider(script: Step[], caps: Partial<Capabilities> = {}) {
  const requests: ProviderRequest[] = [];
  const provider: Provider = {
    name: "portkey",
    billed: true,
    staticCapabilities: { ...MOCK_CAPABILITIES, provider: "portkey", modelString: "gpt-6-luna", ...caps },
    async complete(req) {
      requests.push(structuredClone({ ...req, signal: undefined, mock: undefined }));
      const step = script.shift();
      if (!step) throw new Error("fake provider script exhausted");
      if (step instanceof ProviderError) throw step;
      return {
        text: "",
        refusal: null,
        finishReason: "stop",
        model: req.model,
        usage: { input: 1000, cached: 400, reasoning: 50, output: 200, estimated: false },
        ...step,
      };
    },
  };
  return { provider, requests };
}

function setup(provider: Provider, ledger?: Ledger) {
  const events: UsageEvent[] = [];
  const sleeps: number[] = [];
  let clock = 0;
  const deps: ModelDeps = {
    providerFor: () => provider,
    modelFor: (_stage, override) => override ?? "gpt-6-luna",
    capabilities: async (p) => p.staticCapabilities!,
    ledger:
      ledger ??
      new Ledger({ keySpend: async () => ({ usd: 0, calls: 0, byProvider: {} }), keyBudgetUsd: () => 40, allowOverKeyBudget: () => false, warn: () => {} }),
    usageSink: async (e) => {
      events.push(e);
    },
    prices: () => ({ inputPerM: 0.1, cachedPerM: 0.01, outputPerM: 0.5 }),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    now: () => (clock += 10),
  };
  return { client: createModelClient(deps), events, sleeps };
}

const Out = z.object({ ok: z.boolean(), word: z.string() });
const base = { runId: null, stage: "classifier" as const, system: "static prefix", user: "variable payload", maxOutputTokens: 800 };

describe("callModel", () => {
  it("parses strict output and gates the request on capabilities", async () => {
    const { provider, requests } = fakeProvider([reply('{"ok":true,"word":"tenet"}')]);
    const { client, events } = setup(provider);
    const res = await client.callModel({ ...base, schema: Out, schemaName: "out" });
    expect(res.data).toEqual({ ok: true, word: "tenet" });
    expect(requests[0].responseFormat).toMatchObject({ type: "json_schema" });
    expect(requests[0].temperature).toBe(0);
    expect(requests[0].reasoningEffort).toBe("low");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ stage: "classifier", ok: true, inputTokens: 1000, cachedTokens: 400, outputTokens: 200, responseMode: "strict" });
    expect(events[0].usd).toBeCloseTo((600 * 0.1 + 400 * 0.01 + 200 * 0.5) / 1e6, 12);
  });

  it("omits temperature and reasoning_effort when the model rejects them", async () => {
    const { provider, requests } = fakeProvider([reply('{"ok":true,"word":"x"}')], { temperature: false, reasoningEffort: false });
    const { client } = setup(provider);
    await client.callModel({ ...base, schema: Out });
    expect(requests[0].temperature).toBeUndefined();
    expect(requests[0].reasoningEffort).toBeUndefined();
  });

  it("json_object mode puts the schema in the prompt and extracts fenced JSON", async () => {
    const { provider, requests } = fakeProvider([reply('Here you go:\n```json\n{"ok": false, "word": "y"}\n```')], { responseMode: "json_object" });
    const { client } = setup(provider);
    const res = await client.callModel({ ...base, schema: Out });
    expect(res.data).toEqual({ ok: false, word: "y" });
    expect(requests[0].responseFormat).toEqual({ type: "json_object" });
    expect(requests[0].system).toContain("JSON schema");
  });

  it("repairs invalid output once, then gives up with SchemaInvalid", async () => {
    const ok = fakeProvider([reply('{"ok":"yes"}'), reply('{"ok":true,"word":"fixed"}')]);
    const a = setup(ok.provider);
    const res = await a.client.callModel({ ...base, schema: Out });
    expect(res.data.word).toBe("fixed");
    expect(ok.requests[1].user).toContain("failed validation");
    expect(ok.requests[1].system).toBe(ok.requests[0].system); // the cached prefix is untouched
    expect(a.events.map((e) => e.kind)).toEqual(["call", "repair"]);

    const bad = fakeProvider([reply("nope"), reply("still nope")]);
    await expect(setup(bad.provider).client.callModel({ ...base, schema: Out })).rejects.toBeInstanceOf(SchemaInvalid);
  });

  it("retries a transient error once", async () => {
    const once = fakeProvider([new ProviderError("transient", "502", 502), reply('{"ok":true,"word":"z"}')]);
    const a = setup(once.provider);
    await a.client.callModel({ ...base, schema: Out });
    expect(a.events.map((e) => [e.kind, e.ok])).toEqual([["call", false], ["retry", true]]);

    const twice = fakeProvider([new ProviderError("transient", "502", 502), new ProviderError("transient", "503", 503)]);
    await expect(setup(twice.provider).client.callModel({ ...base, schema: Out })).rejects.toBeInstanceOf(ModelCallFailed);
  });

  it("waits on 429 using retry-after, up to three times, without using the transient retry", async () => {
    const rl = (ms?: number) => new ProviderError("rate_limit", "429", 429, ms);
    const f = fakeProvider([rl(1500), rl(), new ProviderError("transient", "500", 500), reply('{"ok":true,"word":"w"}')]);
    const a = setup(f.provider);
    await a.client.callModel({ ...base, schema: Out });
    expect(a.sleeps).toEqual([1500, 4000, 1000]);

    const g = fakeProvider([rl(), rl(), rl(), rl()]);
    await expect(setup(g.provider).client.callModel({ ...base, schema: Out })).rejects.toBeInstanceOf(ModelCallFailed);
  });

  it("retries a length stop at twice the cap, then marks a target reply truncated", async () => {
    const f = fakeProvider([reply("partial", { finishReason: "length" }), reply("still partial", { finishReason: "length" })]);
    const a = setup(f.provider);
    const res = await a.client.callModel({ ...base, stage: "executor", role: "target", maxOutputTokens: 2000 });
    expect(f.requests.map((r) => r.maxCompletionTokens)).toEqual([2000, 4000]);
    expect(res.truncated).toBe(true);
    expect(res.data).toBe("still partial");
    expect(f.requests[0].responseFormat).toBeUndefined();

    const g = fakeProvider([reply("{", { finishReason: "length" }), reply("{", { finishReason: "length" })]);
    await expect(setup(g.provider).client.callModel({ ...base, schema: Out })).rejects.toBeInstanceOf(SchemaInvalid);
  });

  it("logs missing usage details as null", async () => {
    const f = fakeProvider([reply("hello", { usage: { input: 10, cached: null, reasoning: null, output: 2, estimated: false } })]);
    const a = setup(f.provider);
    await a.client.callModel({ ...base, stage: "executor", role: "target" });
    expect(a.events[0].cachedTokens).toBeNull();
    expect(a.events[0].reasoningTokens).toBeNull();
  });

  it("checks the test budget before every call: $0.004 per call against a $0.01 cap halts after 3", async () => {
    const usage = { input: 0, cached: 0, reasoning: 0, output: 8000, estimated: false }; // 8000 × $0.50/M = $0.004
    const f = fakeProvider(Array.from({ length: 10 }, () => reply("ok", { usage })));
    const ledger = new Ledger({ keySpend: async () => ({ usd: 0, calls: 0, byProvider: {} }), keyBudgetUsd: () => 40, allowOverKeyBudget: () => false, warn: () => {} });
    ledger.open("run1", { capUsd: 0.01, startedExecutionAt: "now" });
    const a = setup(f.provider, ledger);
    const call = () => a.client.callModel({ ...base, runId: "run1", stage: "executor", role: "target" });
    await call();
    await call();
    await call();
    await expect(call()).rejects.toBeInstanceOf(BudgetExceeded);
    expect(f.requests).toHaveLength(3);
    // analysis stages are not capped by the test budget
    await a.client.callModel({ ...base, runId: "run1", stage: "classifier" });
    expect(f.requests).toHaveLength(4);
  });

  it("the mock provider runs the agent's mock and fails loudly without one", async () => {
    const a = setup(mockProvider);
    const res = await a.client.callModel({ ...base, schema: Out, mock: () => ({ ok: true, word: "mocked" }) });
    expect(res.data.word).toBe("mocked");
    expect(a.events[0]).toMatchObject({ provider: "mock", usageEstimated: true });
    await expect(a.client.callModel({ ...base, schema: Out })).rejects.toBeInstanceOf(NoMockHandler);
  });

  it("extractJson takes the outermost object", () => {
    expect(extractJson('noise {"a": {"b": 1}} trailing')).toBe('{"a": {"b": 1}}');
  });
});

describe("capability resolver", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "tenet-caps-"));
    process.env.TENET_DATA_DIR = dir;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.TENET_DATA_DIR;
  });

  it("probes once under concurrency and remembers the result", async () => {
    let rawCalls = 0;
    const provider: Provider = {
      name: "portkey",
      billed: true,
      async complete() {
        throw new Error("not used");
      },
    };
    const resolve = createCapabilityResolver(async (_p, req) => {
      rawCalls += 1;
      if (req.temperature !== undefined) throw new ProviderError("fatal", "temperature is not supported", 400);
      return {
        response: { text: "OK", refusal: null, finishReason: "stop", model: req.model, usage: { input: 5, cached: 0, reasoning: 3, output: 1, estimated: false } },
        event: {} as UsageEvent,
      };
    });
    const results = await Promise.all([1, 2, 3, 4].map(() => resolve(provider, "gpt-6-luna")));
    const callsAfterFirst = rawCalls;
    expect(results.every((r) => r === results[0])).toBe(true);
    expect(results[0]).toMatchObject({ modelString: "gpt-6-luna", responseMode: "strict", temperature: false, reasoningEffort: ["low", "minimal"] });
    expect(callsAfterFirst).toBe(5); // model string, strict schema, temperature, two effort values
    await resolve(provider, "gpt-6-luna");
    expect(rawCalls).toBe(callsAfterFirst);
  });
});
