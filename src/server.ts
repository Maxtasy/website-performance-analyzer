import path from "node:path";
import express from "express";
import { runCheck, CheckOptions, ShopifyPreviewConfig, validateCheckOptions } from "./core";

const DEFAULT_PORT = 4321;

function parsePort(argv: string[]): number {
  const index = argv.indexOf("--port");
  if (index === -1) {
    return DEFAULT_PORT;
  }
  const value = argv[index + 1];
  const parsed = Number(value);
  if (!value || !Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`--port requires a valid port number (got "${value ?? ""}")`);
  }
  return parsed;
}

function parseCheckRequest(body: unknown): CheckOptions {
  if (typeof body !== "object" || body === null) {
    throw new Error("Request body must be a JSON object");
  }
  const {
    url,
    compareUrl,
    runs,
    warmupUrls,
    warmupUrlsB,
    shopifyPasswordA,
    shopifyThemeIdA,
    shopifyPasswordB,
    shopifyThemeIdB,
  } = body as Record<string, unknown>;

  if (typeof url !== "string" || url.trim() === "") {
    throw new Error("`url` is required");
  }
  if (compareUrl !== undefined && compareUrl !== null && typeof compareUrl !== "string") {
    throw new Error("`compareUrl` must be a string");
  }
  if (runs !== undefined && typeof runs !== "number") {
    throw new Error("`runs` must be a number");
  }
  if (warmupUrls !== undefined && !Array.isArray(warmupUrls)) {
    throw new Error("`warmupUrls` must be an array of strings");
  }
  if (warmupUrlsB !== undefined && !Array.isArray(warmupUrlsB)) {
    throw new Error("`warmupUrlsB` must be an array of strings");
  }

  const urls = [url.trim()];
  if (typeof compareUrl === "string" && compareUrl.trim() !== "") {
    urls.push(compareUrl.trim());
  }

  const cleanUrlList = (list: unknown): string[] =>
    Array.isArray(list) ? list.filter((u): u is string => typeof u === "string" && u.trim() !== "") : [];

  const cleanString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

  const buildShopifyPreview = (
    password: unknown,
    themeId: unknown
  ): ShopifyPreviewConfig | undefined => {
    const cleanPassword = cleanString(password);
    const cleanThemeId = cleanString(themeId);
    if (!cleanPassword && !cleanThemeId) {
      return undefined;
    }
    if (!cleanPassword || !cleanThemeId) {
      throw new Error("Shopify store password and preview theme ID must be provided together");
    }
    return { password: cleanPassword, previewThemeId: cleanThemeId };
  };

  const options: CheckOptions = {
    urls,
    runs: typeof runs === "number" ? Math.trunc(runs) : 1,
    warmupUrls: cleanUrlList(warmupUrls),
    warmupUrlsB: urls.length === 2 ? cleanUrlList(warmupUrlsB) : [],
    shopifyPreviewA: buildShopifyPreview(shopifyPasswordA, shopifyThemeIdA),
    shopifyPreviewB: urls.length === 2 ? buildShopifyPreview(shopifyPasswordB, shopifyThemeIdB) : undefined,
  };

  validateCheckOptions(options);
  return options;
}

export async function startServer(argv: string[]): Promise<void> {
  const port = parsePort(argv);

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.post("/api/check", async (req, res) => {
    let options: CheckOptions;
    try {
      options = parseCheckRequest(req.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
      return;
    }

    try {
      const result = await runCheck(options);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  });

  await new Promise<void>((resolve) => {
    app.listen(port, "127.0.0.1", () => {
      console.log(`perfcheck server running at http://localhost:${port}`);
      resolve();
    });
  });
}
