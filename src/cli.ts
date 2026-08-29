#!/usr/bin/env node
import { measure } from "./measure";
import { measureBrowserMetrics } from "./browserMeasure";

function printUsage(): void {
  console.error("Usage: perfcheck <url>");
}

function formatMs(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(0)}ms`;
}

async function main(): Promise<void> {
  const rawUrl = process.argv[2];

  if (!rawUrl) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const [httpResult, browserResult] = await Promise.all([
      measure(rawUrl),
      measureBrowserMetrics(rawUrl),
    ]);
    console.log(
      `${httpResult.url} — ${httpResult.statusCode} — ` +
        `TTFB: ${formatMs(httpResult.ttfbMs)} — Total: ${formatMs(httpResult.totalMs)} — ` +
        `FCP: ${formatMs(browserResult.fcpMs)} — LCP: ${formatMs(browserResult.lcpMs)}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    process.exitCode = 1;
  }
}

main();
