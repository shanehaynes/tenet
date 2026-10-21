import { parseArgs } from "node:util";
import { loadEnv } from "../core/env";
import { resetModelClient } from "../core/model/client";
import { analyzeCommand, confirmCommand, rulesCommand } from "./commands/analysis";
import { policiesCommand } from "./commands/policies";
import { smokeCommand } from "./commands/smoke";
import { spendCommand } from "./commands/spend";
import type { Command } from "./types";

// `npm run tenet -- <command>`: thin commands over src/core (architecture §11). Every command accepts
// --provider mock|portkey|openai. New commands go in ./commands and in this list.

export const commands: Command[] = [policiesCommand, analyzeCommand, rulesCommand, confirmCommand, smokeCommand, spendCommand];

function help(out: (s: string) => void): void {
  out("Usage: npm run tenet -- <command> [options] [--provider mock|portkey|openai]\n");
  for (const c of commands) out(`  ${c.usage.padEnd(48)} ${c.summary}`);
}

/** Pulls the global --provider flag out of argv and applies it before env and the model client load. */
function applyProvider(argv: string[]): string[] {
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--provider") {
      process.env.TENET_PROVIDER = argv[++i];
    } else if (a.startsWith("--provider=")) {
      process.env.TENET_PROVIDER = a.slice("--provider=".length);
    } else {
      rest.push(a);
    }
  }
  return rest;
}

export async function main(argv: string[]): Promise<number> {
  const out = (line = "") => process.stdout.write(`${line}\n`);
  const err = (line: string) => process.stderr.write(`${line}\n`);
  const args = applyProvider(argv);
  resetModelClient();
  loadEnv();

  const [name, ...rest] = args;
  if (!name || name === "help" || name === "--help" || name === "-h") {
    help(out);
    return name ? 0 : 1;
  }
  const command = commands.find((c) => c.name === name);
  if (!command) {
    err(`Unknown command "${name}".`);
    help(err);
    return 1;
  }
  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: command.options ?? {}, allowPositionals: true, strict: true });
  } catch (e) {
    err(`${(e as Error).message}\nUsage: ${command.usage}`);
    return 1;
  }
  return command.run({ values: parsed.values, positionals: parsed.positionals, out, err });
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((e: unknown) => {
      process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
      process.exitCode = 1;
    });
}
