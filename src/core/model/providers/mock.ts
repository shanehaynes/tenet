import { MOCK_CAPABILITIES } from "../../schemas/capabilities";
import { NoMockHandler, type Provider, type ProviderRequest, type ProviderResponse } from "../types";

// Deterministic, offline, zero-cost (architecture §4.5). Each agent passes its own mock to callModel, next to
// its prompt, so this provider stays generic. Usage is estimated at chars ÷ 4 so the cost UI shows numbers;
// mock calls never count toward the key budget.

export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export const mockProvider: Provider = {
  name: "mock",
  billed: false,
  staticCapabilities: MOCK_CAPABILITIES,
  async complete(req: ProviderRequest): Promise<ProviderResponse> {
    let out: unknown;
    if (req.mock) out = req.mock();
    else if (req.stage === "probe") out = "OK";
    else throw new NoMockHandler(req.stage, req.schemaName);
    const text = typeof out === "string" ? out : JSON.stringify(out);
    return {
      text,
      refusal: null,
      finishReason: "stop",
      model: "mock",
      usage: {
        input: estimateTokens(req.system) + estimateTokens(req.user),
        cached: 0,
        reasoning: 0,
        output: estimateTokens(text),
        estimated: true,
      },
    };
  },
};
