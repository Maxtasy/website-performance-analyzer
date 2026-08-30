import { chromium, BrowserContext } from "playwright";
import { measure } from "./measure";
import { measureBrowserMetrics, measureInContext } from "./browserMeasure";
import { computeStats, Stats } from "./stats";
import { CookieJar } from "./cookieJar";

export interface RunResult {
  url: string;
  statusCode: number;
  ttfbMs: number;
  totalMs: number;
  fcpMs: number | null;
  lcpMs: number | null;
}

export interface MetricStats {
  ttfb: Stats | null;
  total: Stats | null;
  fcp: Stats | null;
  lcp: Stats | null;
}

export interface ComparisonEntry {
  aMedian: number;
  bMedian: number;
  deltaMs: number;
  deltaPct: number | null;
}

export interface ComparisonStats {
  ttfb: ComparisonEntry | null;
  total: ComparisonEntry | null;
  fcp: ComparisonEntry | null;
  lcp: ComparisonEntry | null;
}

export interface CheckOptions {
  urls: string[];
  runs: number;
  /** Warmup URLs for urls[0] (the single URL, or side A in comparison mode). */
  warmupUrls: string[];
  /** Warmup URLs for urls[1] (side B). Only meaningful in comparison mode. */
  warmupUrlsB?: string[];
}

export interface SingleCheckResult {
  mode: "single";
  url: string;
  runs: number;
  results: RunResult[];
  summary: MetricStats;
}

export interface ComparisonCheckResult {
  mode: "comparison";
  urls: [string, string];
  runs: number;
  results: { a: RunResult[]; b: RunResult[] };
  summary: { a: MetricStats; b: MetricStats };
  comparison: ComparisonStats;
}

export type CheckResult = SingleCheckResult | ComparisonCheckResult;

export type ProgressEvent =
  | { type: "warmup"; label: "single" | "A" | "B"; index: number; total: number; url: string }
  | { type: "run"; label: "single" | "A" | "B"; index: number; total: number; result: RunResult };

interface Session {
  cookieJar: CookieJar;
  context: BrowserContext;
}

async function runOnce(url: string, session?: Session): Promise<RunResult> {
  const [httpResult, browserResult] = await Promise.all([
    measure(url, session ? { cookieJar: session.cookieJar } : {}),
    session ? measureInContext(session.context, url) : measureBrowserMetrics(url),
  ]);
  return {
    url: httpResult.url,
    statusCode: httpResult.statusCode,
    ttfbMs: Math.round(httpResult.ttfbMs),
    totalMs: Math.round(httpResult.totalMs),
    fcpMs: browserResult.fcpMs !== null ? Math.round(browserResult.fcpMs) : null,
    lcpMs: browserResult.lcpMs !== null ? Math.round(browserResult.lcpMs) : null,
  };
}

async function runWarmup(
  warmupUrls: string[],
  session: Session,
  label: "single" | "A" | "B",
  onProgress?: (event: ProgressEvent) => void
): Promise<void> {
  for (let i = 0; i < warmupUrls.length; i++) {
    const warmupUrl = warmupUrls[i];
    onProgress?.({ type: "warmup", label, index: i + 1, total: warmupUrls.length, url: warmupUrl });
    try {
      await measure(warmupUrl, { cookieJar: session.cookieJar });
      const page = await session.context.newPage();
      try {
        await page.goto(warmupUrl, { waitUntil: "load" });
      } finally {
        await page.close();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Warmup request to ${warmupUrl} failed: ${message}`);
    }
  }
}

async function buildSession(
  browserPromise: () => Promise<Awaited<ReturnType<typeof chromium.launch>>>,
  warmupUrls: string[],
  label: "single" | "A" | "B",
  onProgress?: (event: ProgressEvent) => void
): Promise<Session | undefined> {
  if (warmupUrls.length === 0) {
    return undefined;
  }
  const browser = await browserPromise();
  const context = await browser.newContext();
  const session: Session = { cookieJar: new CookieJar(), context };
  await runWarmup(warmupUrls, session, label, onProgress);
  return session;
}

function computeMetricStats(results: RunResult[]): MetricStats {
  return {
    ttfb: computeStats(results.map((r) => r.ttfbMs)),
    total: computeStats(results.map((r) => r.totalMs)),
    fcp: computeStats(results.flatMap((r) => (r.fcpMs !== null ? [r.fcpMs] : []))),
    lcp: computeStats(results.flatMap((r) => (r.lcpMs !== null ? [r.lcpMs] : []))),
  };
}

function compareEntry(a: Stats | null, b: Stats | null): ComparisonEntry | null {
  if (!a || !b) {
    return null;
  }
  const deltaMs = b.median - a.median;
  const deltaPct = a.median !== 0 ? (deltaMs / a.median) * 100 : null;
  return { aMedian: a.median, bMedian: b.median, deltaMs, deltaPct };
}

export function validateCheckOptions(options: CheckOptions): void {
  if (options.urls.length === 0) {
    throw new Error("At least one URL is required");
  }
  if (options.urls.length > 2) {
    throw new Error(`perfcheck accepts at most 2 URLs to compare (got ${options.urls.length})`);
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error(`runs must be a positive integer (got ${options.runs})`);
  }
  if ((options.warmupUrlsB?.length ?? 0) > 0 && options.urls.length !== 2) {
    throw new Error("warmupUrlsB (--warmup-b) requires two URLs to compare");
  }
}

export async function runCheck(
  options: CheckOptions,
  onProgress?: (event: ProgressEvent) => void
): Promise<CheckResult> {
  validateCheckOptions(options);
  const { urls, runs, warmupUrls, warmupUrlsB = [] } = options;

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const getBrowser = async () => {
    if (!browser) {
      browser = await chromium.launch();
    }
    return browser;
  };

  try {
    if (urls.length === 1) {
      const url = urls[0];
      const session = await buildSession(getBrowser, warmupUrls, "single", onProgress);
      const results: RunResult[] = [];

      for (let i = 1; i <= runs; i++) {
        const result = await runOnce(url, session);
        results.push(result);
        onProgress?.({ type: "run", label: "single", index: i, total: runs, result });
      }

      return { mode: "single", url, runs, results, summary: computeMetricStats(results) };
    }

    const [urlA, urlB] = urls;
    const sessionA = await buildSession(getBrowser, warmupUrls, "A", onProgress);
    const sessionB = await buildSession(getBrowser, warmupUrlsB, "B", onProgress);

    const resultsA: RunResult[] = [];
    const resultsB: RunResult[] = [];

    for (let i = 1; i <= runs; i++) {
      const a = await runOnce(urlA, sessionA);
      resultsA.push(a);
      onProgress?.({ type: "run", label: "A", index: i, total: runs, result: a });

      const b = await runOnce(urlB, sessionB);
      resultsB.push(b);
      onProgress?.({ type: "run", label: "B", index: i, total: runs, result: b });
    }

    const statsA = computeMetricStats(resultsA);
    const statsB = computeMetricStats(resultsB);

    return {
      mode: "comparison",
      urls: [urlA, urlB],
      runs,
      results: { a: resultsA, b: resultsB },
      summary: { a: statsA, b: statsB },
      comparison: {
        ttfb: compareEntry(statsA.ttfb, statsB.ttfb),
        total: compareEntry(statsA.total, statsB.total),
        fcp: compareEntry(statsA.fcp, statsB.fcp),
        lcp: compareEntry(statsA.lcp, statsB.lcp),
      },
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
