import { chromium, BrowserContext } from "playwright";

export interface BrowserMetrics {
  fcpMs: number | null;
  lcpMs: number | null;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const LCP_SETTLE_MS = 1_000;

declare global {
  interface Window {
    __perfcheck?: { fcp: number | null; lcp: number | null };
  }
}

async function measureInPage(
  context: BrowserContext,
  url: string,
  timeoutMs: number
): Promise<BrowserMetrics> {
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      window.__perfcheck = { fcp: null, lcp: null };

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === "first-contentful-paint") {
              window.__perfcheck!.fcp = entry.startTime;
            }
          }
        }).observe({ type: "paint", buffered: true });
      } catch {
        // paint timing not supported; fcp stays null
      }

      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) {
            window.__perfcheck!.lcp = last.startTime;
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        // LCP not supported; lcp stays null
      }
    });

    await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
    // LCP can keep updating after load until user input; give the observer
    // a short window to settle on its final candidate.
    await page.waitForTimeout(LCP_SETTLE_MS);

    const result = await page.evaluate(() => window.__perfcheck);
    return { fcpMs: result?.fcp ?? null, lcpMs: result?.lcp ?? null };
  } finally {
    await page.close();
  }
}

export async function measureBrowserMetrics(
  url: string,
  options: { timeoutMs?: number } = {}
): Promise<BrowserMetrics> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    return await measureInPage(context, url, timeoutMs);
  } finally {
    await browser.close();
  }
}

/** Like measureBrowserMetrics, but reuses a caller-managed context so cookies
 * (e.g. from a warmup navigation) persist across calls. */
export async function measureInContext(
  context: BrowserContext,
  url: string,
  options: { timeoutMs?: number } = {}
): Promise<BrowserMetrics> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return measureInPage(context, url, timeoutMs);
}
