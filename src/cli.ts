#!/usr/bin/env node
import { measure } from "./measure";

function printUsage(): void {
  console.error("Usage: perfcheck <url>");
}

async function main(): Promise<void> {
  const rawUrl = process.argv[2];

  if (!rawUrl) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const result = await measure(rawUrl);
    console.log(
      `${result.url} — ${result.statusCode} — TTFB: ${result.ttfbMs.toFixed(0)}ms — Total: ${result.totalMs.toFixed(0)}ms`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`perfcheck: ${message}`);
    process.exitCode = 1;
  }
}

main();
