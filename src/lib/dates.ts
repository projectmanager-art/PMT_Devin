/**
 * Local-timezone date helpers.
 * `new Date().toISOString().slice(0, 10)` returns the UTC date, which is wrong
 * for anyone east of UTC in the morning — due dates/today land a day off.
 */

/** Today as a local `YYYY-MM-DD` string. */
export function todayKey(): string {
  return dateKey(new Date())
}

/** A Date -> local `YYYY-MM-DD` key (no UTC shift). */
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
