export interface ParsedArgs {
  url: string;
  runs: number;
}

export function parseArgs(argv: string[]): ParsedArgs {
  let url: string | undefined;
  let runs = 1;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--runs") {
      const value = argv[i + 1];
      const parsed = Number(value);
      if (!value || !Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`--runs requires a positive integer (got "${value ?? ""}")`);
      }
      runs = parsed;
      i++;
    } else if (!arg.startsWith("--") && url === undefined) {
      url = arg;
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }

  if (!url) {
    throw new Error("Missing required <url> argument");
  }

  return { url, runs };
}
