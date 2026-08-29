# perfcheck

A CLI tool that measures basic web performance metrics for a given URL.

## Metrics

- **TTFB** — time to first byte (raw HTTP request)
- **Total** — total time for the HTTP response to fully arrive
- **FCP** — first contentful paint (measured in headless Chromium)
- **LCP** — largest contentful paint (measured in headless Chromium)

## Setup

```bash
npm install
npx playwright install chromium
npm run build
```

The `playwright install` step downloads the Chromium browser binary (~190MB) into a global cache outside this repo (`%LOCALAPPDATA%\ms-playwright` on Windows). It only needs to run once per machine, and again after a fresh clone.

## Usage

```bash
node dist/cli.js <url> [<compareUrl>]
```

Or, to use the `perfcheck` command directly:

```bash
npm link
perfcheck <url>
```

### Example

```bash
perfcheck https://example.com
```

```
https://example.com/ — 200 — TTFB: 134ms — Total: 260ms — FCP: 260ms — LCP: 260ms
```

On failure (invalid URL, unreachable host, timeout), perfcheck prints an error to stderr and exits with a non-zero status code.

### Flags

- `--runs <n>` — run the measurement `n` times and print a min/max/mean/median summary alongside each run's result
- `--json` — print machine-readable JSON instead of the text format (suppresses per-run text lines; a single JSON document is written to stdout)

```bash
perfcheck https://example.com --runs 3
perfcheck https://example.com --json
perfcheck https://example.com --runs 3 --json
```

### Comparing two URLs

Pass a second URL to compare it against the first. Runs interleave A/B/A/B/... rather than running all of A then all of B, so both sides see similar conditions (network drift, time of day) rather than one side being systematically favored:

```bash
perfcheck https://example.com https://example.org --runs 5
```

This prints each interleaved run (`[A 1/5]`, `[B 1/5]`, ...), a summary per URL, and a comparison block (median deltas, ms and %). Add `--json` for a structured `{ urls, runs, results: { a, b }, summary: { a, b }, comparison }` document instead.

## Development

After editing any file in `src/`, rebuild before running:

```bash
npm run build
```
