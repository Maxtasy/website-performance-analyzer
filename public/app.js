const form = document.getElementById("check-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");

function fmt(value) {
  return value === null || value === undefined ? "n/a" : `${Math.round(value)}ms`;
}

function fmt1(value) {
  return value === null || value === undefined ? "n/a" : `${value.toFixed(1)}`;
}

function statsRow(label, stats) {
  if (!stats) {
    return `<tr><td class="py-1 pr-4 font-medium">${label}</td><td colspan="4" class="py-1 text-slate-400">n/a</td></tr>`;
  }
  return `<tr>
    <td class="py-1 pr-4 font-medium">${label}</td>
    <td class="py-1 pr-4">${fmt(stats.min)}</td>
    <td class="py-1 pr-4">${fmt(stats.max)}</td>
    <td class="py-1 pr-4">${fmt(stats.mean)}</td>
    <td class="py-1">${fmt(stats.median)}</td>
  </tr>`;
}

function statsTable(title, summary) {
  return `<div>
    <h3 class="font-medium mb-2">${title}</h3>
    <table class="text-sm w-full">
      <thead>
        <tr class="text-slate-400 text-left">
          <th class="py-1 pr-4 font-normal">Metric</th>
          <th class="py-1 pr-4 font-normal">Min</th>
          <th class="py-1 pr-4 font-normal">Max</th>
          <th class="py-1 pr-4 font-normal">Mean</th>
          <th class="py-1 font-normal">Median</th>
        </tr>
      </thead>
      <tbody>
        ${statsRow("TTFB", summary.ttfb)}
        ${statsRow("Total", summary.total)}
        ${statsRow("FCP", summary.fcp)}
        ${statsRow("LCP", summary.lcp)}
      </tbody>
    </table>
  </div>`;
}

function runsTable(title, results) {
  const rows = results
    .map(
      (r, i) => `<tr>
        <td class="py-1 pr-4 text-slate-400">${i + 1}</td>
        <td class="py-1 pr-4">${r.statusCode}</td>
        <td class="py-1 pr-4">${fmt(r.ttfbMs)}</td>
        <td class="py-1 pr-4">${fmt(r.totalMs)}</td>
        <td class="py-1 pr-4">${fmt(r.fcpMs)}</td>
        <td class="py-1">${fmt(r.lcpMs)}</td>
      </tr>`
    )
    .join("");
  return `<div>
    <h3 class="font-medium mb-2">${title}</h3>
    <table class="text-sm w-full">
      <thead>
        <tr class="text-slate-400 text-left">
          <th class="py-1 pr-4 font-normal">#</th>
          <th class="py-1 pr-4 font-normal">Status</th>
          <th class="py-1 pr-4 font-normal">TTFB</th>
          <th class="py-1 pr-4 font-normal">Total</th>
          <th class="py-1 pr-4 font-normal">FCP</th>
          <th class="py-1 font-normal">LCP</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function comparisonTable(comparison) {
  const rows = ["ttfb", "total", "fcp", "lcp"]
    .map((key) => {
      const label = key === "ttfb" ? "TTFB" : key === "total" ? "Total" : key.toUpperCase();
      const entry = comparison[key];
      if (!entry) {
        return `<tr><td class="py-1 pr-4 font-medium">${label}</td><td colspan="3" class="py-1 text-slate-400">n/a</td></tr>`;
      }
      const sign = entry.deltaMs >= 0 ? "+" : "";
      const pctText = entry.deltaPct === null ? "n/a" : `${sign}${entry.deltaPct.toFixed(1)}%`;
      const colorClass = entry.deltaMs > 0 ? "text-red-600" : entry.deltaMs < 0 ? "text-green-600" : "text-slate-500";
      return `<tr>
        <td class="py-1 pr-4 font-medium">${label}</td>
        <td class="py-1 pr-4">${fmt(entry.aMedian)}</td>
        <td class="py-1 pr-4">${fmt(entry.bMedian)}</td>
        <td class="py-1 ${colorClass}">${sign}${fmt1(entry.deltaMs)}ms (${pctText})</td>
      </tr>`;
    })
    .join("");
  return `<div>
    <h3 class="font-medium mb-2">Comparison (B vs A, median)</h3>
    <table class="text-sm w-full">
      <thead>
        <tr class="text-slate-400 text-left">
          <th class="py-1 pr-4 font-normal">Metric</th>
          <th class="py-1 pr-4 font-normal">A</th>
          <th class="py-1 pr-4 font-normal">B</th>
          <th class="py-1 font-normal">Delta</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderResult(result) {
  const card = (inner) =>
    `<div class="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">${inner}</div>`;

  if (result.mode === "single") {
    return card(
      runsTable(result.url, result.results) + statsTable(`Summary over ${result.runs} run(s)`, result.summary)
    );
  }

  const [urlA, urlB] = result.urls;
  return card(
    runsTable(`A: ${urlA}`, result.results.a) +
      runsTable(`B: ${urlB}`, result.results.b) +
      statsTable(`A summary over ${result.runs} run(s)`, result.summary.a) +
      statsTable(`B summary over ${result.runs} run(s)`, result.summary.b) +
      comparisonTable(result.comparison)
  );
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = document.getElementById("url").value.trim();
  const compareUrl = document.getElementById("compareUrl").value.trim();
  const runs = Number(document.getElementById("runs").value) || 1;
  const warmupUrls = document
    .getElementById("warmupUrls")
    .value.split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  errorEl.classList.add("hidden");
  resultsEl.innerHTML = "";
  statusEl.textContent = "Running… this can take a while for multiple runs.";
  statusEl.classList.remove("hidden");
  submitBtn.disabled = true;

  try {
    const response = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, compareUrl: compareUrl || undefined, runs, warmupUrls }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || `Request failed with status ${response.status}`);
    }

    resultsEl.innerHTML = renderResult(body);
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : String(err);
    errorEl.classList.remove("hidden");
  } finally {
    statusEl.classList.add("hidden");
    submitBtn.disabled = false;
  }
});
