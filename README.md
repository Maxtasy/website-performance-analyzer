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
node dist/cli.js <url>
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

## Development

After editing any file in `src/`, rebuild before running:

```bash
npm run build
```
