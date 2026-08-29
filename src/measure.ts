import * as http from "node:http";
import * as https from "node:https";
import { performance } from "node:perf_hooks";

export interface MeasureResult {
  url: string;
  statusCode: number;
  ttfbMs: number;
  totalMs: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function measure(
  rawUrl: string,
  options: { timeoutMs?: number } = {}
): Promise<MeasureResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return Promise.reject(new Error(`Invalid URL: ${rawUrl}`));
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return Promise.reject(
      new Error(`Unsupported protocol "${url.protocol}" — only http and https are supported`)
    );
  }

  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const start = performance.now();

    const req = client.get(url, (res) => {
      const ttfbMs = performance.now() - start;
      const statusCode = res.statusCode ?? 0;

      res.on("data", () => {
        // Drain the response body; we only need timing, not content.
      });

      res.on("end", () => {
        const totalMs = performance.now() - start;
        resolve({ url: url.toString(), statusCode, ttfbMs, totalMs });
      });

      res.on("error", (err) => reject(err));
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on("error", (err) => reject(err));
  });
}
