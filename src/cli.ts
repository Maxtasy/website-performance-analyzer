#!/usr/bin/env node
import { measure } from "./measure";
import { measureBrowserMetrics } from "./browserMeasure";
import { parseArgs } from "./args";
import { computeStats, Stats } from "./stats";

function printUsage(): void {
  console.error("Usage: perfcheck <url> [--runs <n>] [--json]");
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
  statusCode: number;
  ttfbMs: number;
  totalMs: number;
  fcpMs: number | null;
  lcpMs: number | null;
}

async function main(): Promise<void> {
  let url: string;
  let runs: number;
  let json: boolean;
  try {
    ({ url, runs, json } = parseArgs(process.argv.slice(2)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const results: RunResult[] = [];

    for (let i = 1; i <= runs; i++) {
      const [httpResult, browserResult] = await Promise.all([
        measure(url),
        measureBrowserMetrics(url),
      ]);

      const runResult: RunResult = {
        statusCode: httpResult.statusCode,
        ttfbMs: Math.round(httpResult.ttfbMs),
        totalMs: Math.round(httpResult.totalMs),
        fcpMs: browserResult.fcpMs !== null ? Math.round(browserResult.fcpMs) : null,
        lcpMs: browserResult.lcpMs !== null ? Math.round(browserResult.lcpMs) : null,
      };
      results.push(runResult);

      if (!json) {
        const prefix = runs > 1 ? `[${i}/${runs}] ` : "";
        console.log(
          `${prefix}${httpResult.url} — ${runResult.statusCode} — ` +
            `TTFB: ${formatMs(runResult.ttfbMs)} — Total: ${formatMs(runResult.totalMs)} — ` +
            `FCP: ${formatMs(runResult.fcpMs)} — LCP: ${formatMs(runResult.lcpMs)}`
        );
      }
    }

    const ttfbStats = computeStats(results.map((r) => r.ttfbMs));
    const totalStats = computeStats(results.map((r) => r.totalMs));
    const fcpStats = computeStats(results.flatMap((r) => (r.fcpMs !== null ? [r.fcpMs] : [])));
    const lcpStats = computeStats(results.flatMap((r) => (r.lcpMs !== null ? [r.lcpMs] : [])));

    if (json) {
      if (runs === 1) {
        const [result] = results;
        console.log(
          JSON.stringify(
            {
              url,
              statusCode: result.statusCode,
              ttfbMs: result.ttfbMs,
              totalMs: result.totalMs,
              fcpMs: result.fcpMs,
              lcpMs: result.lcpMs,
            },
            null,
            2
          )
        );
      } else {
        console.log(
          JSON.stringify(
            {
              url,
              runs,
              results,
              summary: {
                ttfb: ttfbStats,
                total: totalStats,
                fcp: fcpStats,
                lcp: lcpStats,
              },
            },
            null,
            2
          )
        );
      }
    } else if (runs > 1) {
      console.log("");
      console.log(`Summary over ${runs} runs:`);
      console.log(formatStatsLine("TTFB", ttfbStats));
      console.log(formatStatsLine("Total", totalStats));
      console.log(formatStatsLine("FCP", fcpStats));
      console.log(formatStatsLine("LCP", lcpStats));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    process.exitCode = 1;
  }
}

main();
