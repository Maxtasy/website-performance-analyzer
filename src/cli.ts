#!/usr/bin/env node
import { measure } from "./measure";
import { measureBrowserMetrics } from "./browserMeasure";
import { parseArgs } from "./args";
import { computeStats, Stats } from "./stats";

function printUsage(): void {
  console.error("Usage: perfcheck <url> [--runs <n>]");
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

async function main(): Promise<void> {
  let url: string;
  let runs: number;
  try {
    ({ url, runs } = parseArgs(process.argv.slice(2)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const ttfbs: number[] = [];
    const totals: number[] = [];
    const fcps: number[] = [];
    const lcps: number[] = [];

    for (let i = 1; i <= runs; i++) {
      const [httpResult, browserResult] = await Promise.all([
        measure(url),
        measureBrowserMetrics(url),
      ]);

      ttfbs.push(httpResult.ttfbMs);
      totals.push(httpResult.totalMs);
      if (browserResult.fcpMs !== null) fcps.push(browserResult.fcpMs);
      if (browserResult.lcpMs !== null) lcps.push(browserResult.lcpMs);

      const prefix = runs > 1 ? `[${i}/${runs}] ` : "";
      console.log(
        `${prefix}${httpResult.url} — ${httpResult.statusCode} — ` +
          `TTFB: ${formatMs(httpResult.ttfbMs)} — Total: ${formatMs(httpResult.totalMs)} — ` +
          `FCP: ${formatMs(browserResult.fcpMs)} — LCP: ${formatMs(browserResult.lcpMs)}`
      );
    }

    if (runs > 1) {
      console.log("");
      console.log(`Summary over ${runs} runs:`);
      console.log(formatStatsLine("TTFB", computeStats(ttfbs)));
      console.log(formatStatsLine("Total", computeStats(totals)));
      console.log(formatStatsLine("FCP", computeStats(fcps)));
      console.log(formatStatsLine("LCP", computeStats(lcps)));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    process.exitCode = 1;
  }
}

main();
