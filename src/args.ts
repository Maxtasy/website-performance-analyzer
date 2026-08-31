import { ShopifyPreviewConfig } from "./core";

export interface ParsedArgs {
  urls: string[];
  runs: number;
  json: boolean;
  warmupUrls: string[];
  warmupUrlsB: string[];
  shopifyPreviewA?: ShopifyPreviewConfig;
  shopifyPreviewB?: ShopifyPreviewConfig;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const urls: string[] = [];
  const warmupUrls: string[] = [];
  const warmupUrlsB: string[] = [];
  let runs = 1;
  let json = false;
  let shopifyPasswordA: string | undefined;
  let shopifyThemeIdA: string | undefined;
  let shopifyPasswordB: string | undefined;
  let shopifyThemeIdB: string | undefined;

  const readValue = (flag: string, i: number): string => {
    const value = argv[i + 1];
    if (!value) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  };

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
      warmupUrls.push(readValue(arg, i));
      i++;
    } else if (arg === "--warmup-b") {
      warmupUrlsB.push(readValue(arg, i));
      i++;
    } else if (arg === "--shopify-password") {
      shopifyPasswordA = readValue(arg, i);
      i++;
    } else if (arg === "--shopify-theme-id") {
      shopifyThemeIdA = readValue(arg, i);
      i++;
    } else if (arg === "--shopify-password-b") {
      shopifyPasswordB = readValue(arg, i);
      i++;
    } else if (arg === "--shopify-theme-id-b") {
      shopifyThemeIdB = readValue(arg, i);
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
  if (warmupUrlsB.length > 0 && urls.length !== 2) {
    throw new Error("--warmup-b requires two URLs to compare (only 1 given)");
  }
  if ((shopifyPasswordB || shopifyThemeIdB) && urls.length !== 2) {
    throw new Error("--shopify-password-b / --shopify-theme-id-b require two URLs to compare");
  }
  if (Boolean(shopifyPasswordA) !== Boolean(shopifyThemeIdA)) {
    throw new Error("--shopify-password and --shopify-theme-id must be used together");
  }
  if (Boolean(shopifyPasswordB) !== Boolean(shopifyThemeIdB)) {
    throw new Error("--shopify-password-b and --shopify-theme-id-b must be used together");
  }

  return {
    urls,
    runs,
    json,
    warmupUrls,
    warmupUrlsB,
    shopifyPreviewA:
      shopifyPasswordA && shopifyThemeIdA
        ? { password: shopifyPasswordA, previewThemeId: shopifyThemeIdA }
        : undefined,
    shopifyPreviewB:
      shopifyPasswordB && shopifyThemeIdB
        ? { password: shopifyPasswordB, previewThemeId: shopifyThemeIdB }
        : undefined,
  };
}
