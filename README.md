# perfcheck

A CLI tool that measures basic web performance metrics for a given URL, with support for repeated runs, A/B comparison between two URLs, and an optional local web UI (`perfcheck serve`).

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
node dist/cli.js <url> [<compareUrl>] [--runs <n>] [--json]
```

Or, to use the `perfcheck` command directly:

```bash
npm link
perfcheck <url> [<compareUrl>] [--runs <n>] [--json]
```

On failure (invalid URL, unreachable host, timeout), perfcheck prints an error to stderr and exits with a non-zero status code.

### Single URL

```bash
perfcheck https://example.com
```

```
https://example.com/ — 200 — TTFB: 127ms — Total: 127ms — FCP: 100ms — LCP: 100ms
```

### Repeated runs (`--runs`)

Runs the measurement `n` times and prints a min/max/mean/median summary:

```bash
perfcheck https://example.com --runs 3
```

```
[1/3] https://example.com/ — 200 — TTFB: 113ms — Total: 114ms — FCP: 104ms — LCP: 104ms
[2/3] https://example.com/ — 200 — TTFB: 32ms — Total: 32ms — FCP: 104ms — LCP: 104ms
[3/3] https://example.com/ — 200 — TTFB: 30ms — Total: 30ms — FCP: 92ms — LCP: 92ms

Summary over 3 runs:
  TTFB   — min: 30ms  max: 113ms  mean: 58ms  median: 32ms
  Total  — min: 30ms  max: 114ms  mean: 59ms  median: 32ms
  FCP    — min: 92ms  max: 104ms  mean: 100ms  median: 104ms
  LCP    — min: 92ms  max: 104ms  mean: 100ms  median: 104ms
```

### JSON output (`--json`)

Prints a single machine-readable JSON document to stdout instead of text (safe to pipe into `jq` or another script — no other text is written to stdout in this mode):

```bash
perfcheck https://example.com --json
```

```json
{
  "url": "https://example.com/",
  "statusCode": 200,
  "ttfbMs": 102,
  "totalMs": 102,
  "fcpMs": 96,
  "lcpMs": 96
}
```

`--runs` and `--json` combine — with more than one run, the JSON document includes the full `results` array plus a `summary`:

```bash
perfcheck https://example.com --runs 2 --json
```

```json
{
  "url": "https://example.com",
  "runs": 2,
  "results": [
    { "url": "https://example.com/", "statusCode": 200, "ttfbMs": 120, "totalMs": 121, "fcpMs": 104, "lcpMs": 104 },
    { "url": "https://example.com/", "statusCode": 200, "ttfbMs": 27, "totalMs": 28, "fcpMs": 100, "lcpMs": 100 }
  ],
  "summary": {
    "ttfb": { "min": 27, "max": 120, "mean": 73.5, "median": 73.5 },
    "total": { "min": 28, "max": 121, "mean": 74.5, "median": 74.5 },
    "fcp": { "min": 100, "max": 104, "mean": 102, "median": 102 },
    "lcp": { "min": 100, "max": 104, "mean": 102, "median": 102 }
  }
}
```

### Comparing two URLs

Pass a second URL to compare it against the first. Runs interleave A/B/A/B/... rather than running all of A then all of B, so both sides see similar conditions (network drift, time of day) instead of one side being systematically favored:

```bash
perfcheck https://example.com https://example.org --runs 3
```

```
[A 1/3] https://example.com/ — 200 — TTFB: 119ms — Total: 120ms — FCP: 104ms — LCP: 104ms
[B 1/3] https://example.org/ — 200 — TTFB: 116ms — Total: 116ms — FCP: 96ms — LCP: 96ms
[A 2/3] https://example.com/ — 200 — TTFB: 28ms — Total: 28ms — FCP: 104ms — LCP: 104ms
[B 2/3] https://example.org/ — 200 — TTFB: 29ms — Total: 29ms — FCP: 128ms — LCP: 128ms
[A 3/3] https://example.com/ — 200 — TTFB: 36ms — Total: 36ms — FCP: 108ms — LCP: 108ms
[B 3/3] https://example.org/ — 200 — TTFB: 25ms — Total: 25ms — FCP: 104ms — LCP: 104ms

Summary over 3 runs — A: https://example.com
  TTFB   — min: 28ms  max: 119ms  mean: 61ms  median: 36ms
  Total  — min: 28ms  max: 120ms  mean: 61ms  median: 36ms
  FCP    — min: 104ms  max: 108ms  mean: 105ms  median: 104ms
  LCP    — min: 104ms  max: 108ms  mean: 105ms  median: 104ms

Summary over 3 runs — B: https://example.org
  TTFB   — min: 25ms  max: 116ms  mean: 57ms  median: 29ms
  Total  — min: 25ms  max: 116ms  mean: 57ms  median: 29ms
  FCP    — min: 96ms  max: 128ms  mean: 109ms  median: 104ms
  LCP    — min: 96ms  max: 128ms  mean: 109ms  median: 104ms

Comparison (B vs A, median):
  TTFB   — A: 36ms  B: 29ms  Δ -7ms (-19.4%)
  Total  — A: 36ms  B: 29ms  Δ -7ms (-19.4%)
  FCP    — A: 104ms  B: 104ms  Δ +0ms (+0.0%)
  LCP    — A: 104ms  B: 104ms  Δ +0ms (+0.0%)
```

Add `--json` for a structured document with per-run results, per-URL summaries, and the comparison deltas:

```bash
perfcheck https://example.com https://example.org --runs 2 --json
```

```json
{
  "urls": ["https://example.com", "https://example.org"],
  "runs": 2,
  "results": {
    "a": [ { "url": "https://example.com/", "statusCode": 200, "ttfbMs": 109, "totalMs": 110, "fcpMs": 112, "lcpMs": 112 }, "..." ],
    "b": [ { "url": "https://example.org/", "statusCode": 200, "ttfbMs": 67, "totalMs": 67, "fcpMs": 104, "lcpMs": 104 }, "..." ]
  },
  "summary": {
    "a": {
      "ttfb": { "min": 22, "max": 109, "mean": 65.5, "median": 65.5 },
      "total": { "min": 22, "max": 110, "mean": 66, "median": 66 },
      "fcp": { "min": 104, "max": 112, "mean": 108, "median": 108 },
      "lcp": { "min": 104, "max": 112, "mean": 108, "median": 108 }
    },
    "b": {
      "ttfb": { "min": 24, "max": 67, "mean": 45.5, "median": 45.5 },
      "total": { "min": 24, "max": 67, "mean": 45.5, "median": 45.5 },
      "fcp": { "min": 104, "max": 124, "mean": 114, "median": 114 },
      "lcp": { "min": 104, "max": 124, "mean": 114, "median": 114 }
    }
  },
  "comparison": {
    "ttfb": { "aMedian": 65.5, "bMedian": 45.5, "deltaMs": -20, "deltaPct": -30.53 },
    "total": { "aMedian": 66, "bMedian": 45.5, "deltaMs": -20.5, "deltaPct": -31.06 },
    "fcp": { "aMedian": 108, "bMedian": 114, "deltaMs": 6, "deltaPct": 5.56 },
    "lcp": { "aMedian": 108, "bMedian": 114, "deltaMs": 6, "deltaPct": 5.56 }
  }
}
```

(`results` entries truncated with `"..."` above for brevity — the real output includes one object per run.)

### Warming up a session (`--warmup`)

Some sites require state — a login cookie, a password-protected preview gate — before the page you actually want to measure is reachable. Pass `--warmup <url>` (repeatable) to visit one or more URLs first; their timing isn't measured, but any cookies they set persist into the real measurement(s) that follow. Warmup URLs run in the order given, once, before anything else — including every round of `--runs` and both sides of a comparison.

```bash
perfcheck https://httpbin.org/cookies --warmup "https://httpbin.org/cookies/set?session=abc123"
```

```
Warmup 1/1: https://httpbin.org/cookies/set?session=abc123
https://httpbin.org/cookies — 200 — TTFB: 108ms — Total: 109ms — FCP: 124ms — LCP: 124ms
```

Warmup lines are suppressed when `--json` is set, so stdout still carries exactly one JSON document.

**Example: unlocking a password-protected Shopify preview theme.** Shopify's storefront password gate and theme preview selection both work via cookies, so visiting them in order before the real test gives you a session that can see the gated, previewed page:

```bash
perfcheck https://example.myshopify.com \
  --warmup "https://example.myshopify.com/password?password=actual_password" \
  --warmup "https://example.myshopify.com/?preview_theme_id=12kjh123hj2131&pb=0"
```

Cookies are tracked separately for the raw HTTP requests (TTFB/Total) and for the headless browser (FCP/LCP) — each gets its own warmup pass so both paths see the authenticated, previewed page.

**Comparison mode: independent warmup per side.** `--warmup` only warms up the first URL (A). If you're comparing two different preview themes (or two different password-protected stores), B needs its own cookies — use `--warmup-b`, repeatable the same way. A and B each get their own cookie jar and browser session, so nothing leaks between them:

```bash
perfcheck https://example.myshopify.com https://example.myshopify.com \
  --warmup "https://example.myshopify.com/password?password=actual_password" \
  --warmup "https://example.myshopify.com/?preview_theme_id=THEME_A&pb=0" \
  --warmup-b "https://example.myshopify.com/password?password=actual_password" \
  --warmup-b "https://example.myshopify.com/?preview_theme_id=THEME_B&pb=0"
```

`--warmup-b` requires two URLs (it errors if used with only one). If only one side needs warmup, just omit the other flag — that side runs stateless as usual.

## Flags

- `--runs <n>` — repeat the measurement `n` times (or `n` interleaved rounds in comparison mode) and summarize with min/max/mean/median
- `--json` — print a single machine-readable JSON document to stdout instead of text
- `--warmup <url>` — visit a URL first to establish session cookies for the single URL (or side A in comparison mode); repeatable, runs in order, not measured
- `--warmup-b <url>` — same, but for side B in comparison mode (requires two URLs; independent session from `--warmup`)

## Web UI

`perfcheck serve` starts a local server with a browser-based form for the same functionality — URL, compare URL, independent warmup URLs for A and B (one per line each), and run count — instead of the command line:

```bash
perfcheck serve
```

```
perfcheck server running at http://localhost:4321
```

Open that URL in a browser, fill in the form, and click "Run test". The page waits for the whole test to finish (no live per-run progress yet) and then renders per-run tables, summary stats, and — if a compare URL was given — the comparison table, using the same numbers the CLI would print.

Override the port with `--port`:

```bash
perfcheck serve --port 8080
```

The server binds to `127.0.0.1` only (not your network), same trust boundary as running the CLI directly.

## Development

After editing any file in `src/`, rebuild before running:

```bash
npm run build
```
