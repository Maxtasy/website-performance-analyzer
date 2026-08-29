export interface ParsedArgs {
  urls: string[];
  runs: number;
  json: boolean;
  warmupUrls: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const urls: string[] = [];
  const warmupUrls: string[] = [];
  let runs = 1;
  let json = false;

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
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--warmup") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--warmup requires a URL argument");
      }
      warmupUrls.push(value);
      i++;
    } else if (!arg.startsWith("--")) {
      urls.push(arg);
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }

  if (urls.length === 0) {
    throw new Error("Missing required <url> argument");
  }
  if (urls.length > 2) {
    throw new Error(`perfcheck accepts at most 2 URLs to compare (got ${urls.length})`);
  }

  return { urls, runs, json, warmupUrls };
}
