#!/usr/bin/env node
import { measure } from "./measure";
import { measureBrowserMetrics } from "./browserMeasure";
import { parseArgs } from "./args";
import { computeStats, Stats } from "./stats";

function printUsage(): void {
  console.error("Usage: perfcheck <url> [<compareUrl>] [--runs <n>] [--json]");
}

function formatMs(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(0)}ms`;
}

function formatStatsLine(label: string, stats: Stats | null): string {
  if (!stats) {
    return `  ${label.padEnd(6)} — n/a`;
  }
  return (
    `  ${label.padEnd(6)} — min: ${stats.min.toFixed(0)}ms  max: ${stats.max.toFixed(0)}ms  ` +
    `mean: ${stats.mean.toFixed(0)}ms  median: ${stats.median.toFixed(0)}ms`
  );
}

interface RunResult {
  url: string;
  statusCode: number;
  ttfbMs: number;
  totalMs: number;
  fcpMs: number | null;
  lcpMs: number | null;
}

interface MetricStats {
  ttfb: Stats | null;
  total: Stats | null;
  fcp: Stats | null;
  lcp: Stats | null;
}

interface ComparisonEntry {
  aMedian: number;
  bMedian: number;
  deltaMs: number;
  deltaPct: number | null;
}

async function runOnce(url: string): Promise<RunResult> {
  const [httpResult, browserResult] = await Promise.all([
    measure(url),
    measureBrowserMetrics(url),
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

function formatComparisonLine(label: string, entry: ComparisonEntry | null): string {
  if (!entry) {
    return `  ${label.padEnd(6)} — n/a`;
  }
  const sign = entry.deltaMs >= 0 ? "+" : "";
  const pct = entry.deltaPct === null ? "n/a" : `${sign}${entry.deltaPct.toFixed(1)}%`;
  return (
    `  ${label.padEnd(6)} — A: ${entry.aMedian.toFixed(0)}ms  B: ${entry.bMedian.toFixed(0)}ms  ` +
    `Δ ${sign}${entry.deltaMs.toFixed(0)}ms (${pct})`
  );
}

function printSummary(title: string, stats: MetricStats): void {
  console.log(title);
  console.log(formatStatsLine("TTFB", stats.ttfb));
  console.log(formatStatsLine("Total", stats.total));
  console.log(formatStatsLine("FCP", stats.fcp));
  console.log(formatStatsLine("LCP", stats.lcp));
}

async function runSingle(url: string, runs: number, json: boolean): Promise<void> {
  const results: RunResult[] = [];

  for (let i = 1; i <= runs; i++) {
    const result = await runOnce(url);
    results.push(result);

    if (!json) {
      const prefix = runs > 1 ? `[${i}/${runs}] ` : "";
      console.log(
        `${prefix}${result.url} — ${result.statusCode} — ` +
          `TTFB: ${formatMs(result.ttfbMs)} — Total: ${formatMs(result.totalMs)} — ` +
          `FCP: ${formatMs(result.fcpMs)} — LCP: ${formatMs(result.lcpMs)}`
      );
    }
  }

  const stats = computeMetricStats(results);

  if (json) {
    if (runs === 1) {
      console.log(JSON.stringify(results[0], null, 2));
    } else {
      console.log(JSON.stringify({ url, runs, results, summary: stats }, null, 2));
    }
  } else if (runs > 1) {
    console.log("");
    printSummary(`Summary over ${runs} runs:`, stats);
  }
}

async function runComparison(
  urlA: string,
  urlB: string,
  runs: number,
  json: boolean
): Promise<void> {
  const resultsA: RunResult[] = [];
  const resultsB: RunResult[] = [];

  for (let i = 1; i <= runs; i++) {
    const a = await runOnce(urlA);
    resultsA.push(a);
    if (!json) {
      console.log(
        `[A ${i}/${runs}] ${a.url} — ${a.statusCode} — ` +
          `TTFB: ${formatMs(a.ttfbMs)} — Total: ${formatMs(a.totalMs)} — ` +
          `FCP: ${formatMs(a.fcpMs)} — LCP: ${formatMs(a.lcpMs)}`
      );
    }

    const b = await runOnce(urlB);
    resultsB.push(b);
    if (!json) {
      console.log(
        `[B ${i}/${runs}] ${b.url} — ${b.statusCode} — ` +
          `TTFB: ${formatMs(b.ttfbMs)} — Total: ${formatMs(b.totalMs)} — ` +
          `FCP: ${formatMs(b.fcpMs)} — LCP: ${formatMs(b.lcpMs)}`
      );
    }
  }

  const statsA = computeMetricStats(resultsA);
  const statsB = computeMetricStats(resultsB);
  const comparison = {
    ttfb: compareEntry(statsA.ttfb, statsB.ttfb),
    total: compareEntry(statsA.total, statsB.total),
    fcp: compareEntry(statsA.fcp, statsB.fcp),
    lcp: compareEntry(statsA.lcp, statsB.lcp),
  };

  if (json) {
    console.log(
      JSON.stringify(
        {
          urls: [urlA, urlB],
          runs,
          results: { a: resultsA, b: resultsB },
          summary: { a: statsA, b: statsB },
          comparison,
        },
        null,
        2
      )
    );
  } else {
    console.log("");
    printSummary(`Summary over ${runs} runs — A: ${urlA}`, statsA);
    console.log("");
    printSummary(`Summary over ${runs} runs — B: ${urlB}`, statsB);
    console.log("");
    console.log("Comparison (B vs A, median):");
    console.log(formatComparisonLine("TTFB", comparison.ttfb));
    console.log(formatComparisonLine("Total", comparison.total));
    console.log(formatComparisonLine("FCP", comparison.fcp));
    console.log(formatComparisonLine("LCP", comparison.lcp));
  }
}

async function main(): Promise<void> {
  let urls: string[];
  let runs: number;
  let json: boolean;
  try {
    ({ urls, runs, json } = parseArgs(process.argv.slice(2)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    if (urls.length === 1) {
      await runSingle(urls[0], runs, json);
    } else {
      await runComparison(urls[0], urls[1], runs, json);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    process.exitCode = 1;
  }
}

main();
