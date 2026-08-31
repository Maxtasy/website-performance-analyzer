import * as http from "node:http";
import * as https from "node:https";
import { performance } from "node:perf_hooks";
import { CookieJar } from "./cookieJar";

export interface MeasureResult {
  url: string;
  statusCode: number;
  ttfbMs: number;
  totalMs: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

// A raw Node http(s) request otherwise sends almost no headers, which many
// sites' bot/WAF protection (Shopify included) blocks outright — even with
// a valid session cookie. These make the request look like a real browser.
const BROWSER_LIKE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export function measure(
  rawUrl: string,
  options: { timeoutMs?: number; cookieJar?: CookieJar } = {}
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
  const cookieHeader = options.cookieJar?.getCookieHeader();

  return new Promise((resolve, reject) => {
    const start = performance.now();

    const req = client.get(
      url,
      { headers: { ...BROWSER_LIKE_HEADERS, ...(cookieHeader ? { Cookie: cookieHeader } : {}) } },
      (res) => {
        const ttfbMs = performance.now() - start;
        const statusCode = res.statusCode ?? 0;

        options.cookieJar?.applySetCookie(res.headers["set-cookie"]);

        res.on("data", () => {
          // Drain the response body; we only need timing, not content.
        });

        res.on("end", () => {
          const totalMs = performance.now() - start;
          resolve({ url: url.toString(), statusCode, ttfbMs, totalMs });
        });

        res.on("error", (err) => reject(err));
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on("error", (err) => reject(err));
  });
}
