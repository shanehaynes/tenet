import { settings } from "../src/core/config";
import { KEY_NAMES, loadEnv, maskKey, NO_KEY_MESSAGE, resolveProvider } from "../src/core/env";
import { readCapabilitiesFile } from "../src/core/model/capabilities";
import { modelClient } from "../src/core/model/client";
import { capabilitiesKey } from "../src/core/schemas/capabilities";
import { keySpend } from "../src/core/store/usage";

// `npm run doctor`: README step 4. Checks Node, finds the .env (repo folder, then one level up), shows which
// key is present and which provider will be used, then makes one small model call.

async function main(): Promise<number> {
  let ok = true;
  const print = (label: string, value: string) => console.log(`${label.padEnd(22)} ${value}`);

  const [major, minor] = process.versions.node.split(".").map(Number);
  const nodeOk = major > 22 || (major === 22 && minor >= 12);
  print("Node", `${process.versions.node} ${nodeOk ? "ok" : "— Tenet needs Node 22.12 or newer"}`);
  ok &&= nodeOk;

  const shellHadKey = KEY_NAMES.some((k) => Boolean(process.env[k]?.trim()));
  const envFile = loadEnv();
  print(".env", envFile ?? (shellHadKey ? "none found (keys come from the shell environment)" : "none found in ./ or ../"));
  for (const k of KEY_NAMES) print(k, maskKey(process.env[k]) ?? "not set");

  let provider: string;
  try {
    provider = resolveProvider();
  } catch {
    print("Provider", "none");
    console.log(`\n${NO_KEY_MESSAGE}`);
    return 1;
  }
  const s = settings();
  print("Provider", `${provider} (model ${s.targetModel})`);

  const spend = await keySpend();
  print("Key spend", `$${spend.usd.toFixed(4)} of $${s.keyBudgetUsd} budget (${spend.calls} billed calls)`);

  if (provider === "mock") {
    console.log("\nMock provider: no model call made. Results are synthetic.");
    return ok ? 0 : 1;
  }

  const started = Date.now();
  try {
    const res = await modelClient().callModel({
      runId: null,
      stage: "probe",
      system: "You are a connectivity check for a testing tool.",
      user: "Reply with the single word OK.",
      maxOutputTokens: 400,
    });
    print("Model call", `ok in ${Date.now() - started} ms, reply "${res.text.trim().slice(0, 40)}"`);
    const caps = (await readCapabilitiesFile())[capabilitiesKey(provider, s.targetModel)];
    if (caps) print("Capabilities", `${caps.source}: ${caps.responseMode} output, temperature ${caps.temperature ? "on" : "off"}, effort ${caps.reasoningEffort === false ? "n/a" : caps.reasoningEffort.join("/")}`);
  } catch (err) {
    ok = false;
    print("Model call", `FAILED: ${(err as Error).message}`);
    console.log("\nCheck the key, then run `npm run smoke` for a detailed probe.");
  }
  return ok ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
