import type { ParseArgsConfig } from "node:util";

export type CommandContext = {
  values: Record<string, string | boolean | (string | boolean)[] | undefined>;
  positionals: string[];
  out: (line?: string) => void;
  err: (line: string) => void;
};

export type Command = {
  name: string;
  summary: string;
  usage: string;
  options?: ParseArgsConfig["options"];
  run(ctx: CommandContext): Promise<number>;
};
