/** Format seconds as a compact clock: 20 → "0:20", 65 → "1:05". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** Format whole rupees with Indian digit grouping: 119999 → "₹1,19,999". */
export function formatINR(rupees: number): string {
  return `₹${Math.round(rupees).toLocaleString("en-IN")}`;
}
