#!/usr/bin/env node
import { parseArgs } from "./args";
import { runCheck, CheckResult, ProgressEvent, RunResult, MetricStats, ComparisonEntry } from "./core";

function printUsage(): void {
  console.error(
    "Usage: perfcheck <url> [<compareUrl>] [--runs <n>] [--json] [--warmup <url>]...\n" +
      "       perfcheck serve [--port <n>]"
  );
}

function formatMs(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(0)}ms`;
}

function formatStatsLine(label: string, stats: MetricStats["ttfb"]): string {
  if (!stats) {
    return `  ${label.padEnd(6)} — n/a`;
  }
  return (
    `  ${label.padEnd(6)} — min: ${stats.min.toFixed(0)}ms  max: ${stats.max.toFixed(0)}ms  ` +
    `mean: ${stats.mean.toFixed(0)}ms  median: ${stats.median.toFixed(0)}ms`
  );
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

function printRunLine(prefix: string, result: RunResult): void {
  console.log(
    `${prefix}${result.url} — ${result.statusCode} — ` +
      `TTFB: ${formatMs(result.ttfbMs)} — Total: ${formatMs(result.totalMs)} — ` +
      `FCP: ${formatMs(result.fcpMs)} — LCP: ${formatMs(result.lcpMs)}`
  );
}

function makeProgressPrinter(runs: number): (event: ProgressEvent) => void {
  return (event) => {
    if (event.type === "warmup") {
      console.log(`Warmup ${event.index}/${event.total}: ${event.url}`);
      return;
    }
    const prefix =
      event.label === "single"
        ? runs > 1
          ? `[${event.index}/${event.total}] `
          : ""
        : `[${event.label} ${event.index}/${event.total}] `;
    printRunLine(prefix, event.result);
  };
}

function printResult(result: CheckResult, json: boolean): void {
  if (json) {
    if (result.mode === "single") {
      if (result.runs === 1) {
        console.log(JSON.stringify(result.results[0], null, 2));
      } else {
        console.log(
          JSON.stringify(
            { url: result.url, runs: result.runs, results: result.results, summary: result.summary },
            null,
            2
          )
        );
      }
    } else {
      console.log(
        JSON.stringify(
          {
            urls: result.urls,
            runs: result.runs,
            results: result.results,
            summary: result.summary,
            comparison: result.comparison,
          },
          null,
          2
        )
      );
    }
    return;
  }

  if (result.mode === "single") {
    if (result.runs > 1) {
      console.log("");
      printSummary(`Summary over ${result.runs} runs:`, result.summary);
    }
  } else {
    console.log("");
    printSummary(`Summary over ${result.runs} runs — A: ${result.urls[0]}`, result.summary.a);
    console.log("");
    printSummary(`Summary over ${result.runs} runs — B: ${result.urls[1]}`, result.summary.b);
    console.log("");
    console.log("Comparison (B vs A, median):");
    console.log(formatComparisonLine("TTFB", result.comparison.ttfb));
    console.log(formatComparisonLine("Total", result.comparison.total));
    console.log(formatComparisonLine("FCP", result.comparison.fcp));
    console.log(formatComparisonLine("LCP", result.comparison.lcp));
  }
}

async function runCli(): Promise<void> {
  let urls: string[];
  let runs: number;
  let json: boolean;
  let warmupUrls: string[];
  try {
    ({ urls, runs, json, warmupUrls } = parseArgs(process.argv.slice(2)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const result = await runCheck({ urls, runs, warmupUrls }, json ? undefined : makeProgressPrinter(runs));
    printResult(result, json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  if (process.argv[2] === "serve") {
    const { startServer } = await import("./server");
    await startServer(process.argv.slice(3));
    return;
  }
  await runCli();
}

main();
