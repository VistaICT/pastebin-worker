export function formatBytes(value: number, fractionDigits = 1) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(fractionDigits)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(fractionDigits)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(Math.max(2, fractionDigits))} GB`;
}