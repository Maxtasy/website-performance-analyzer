export interface Stats {
  min: number;
  max: number;
  mean: number;
  median: number;
}

export function computeStats(values: number[]): Stats | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return { min, max, mean, median };
}
