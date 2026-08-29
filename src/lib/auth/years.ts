/**
 * Years offered in the signup form, newest first.
 *
 * Kept out of the server-actions module because every export from a
 * "use server" file must be an async server action, and this is neither.
 */
export function joinYearOptions(): number[] {
  const current = new Date().getFullYear();
  // Back to 2025, when the Research Cell was founded. A student who joined in
  // 2025 must still be able to say so, however long ago that becomes -- the
  // year joined is entered manually and never inferred from today's date.
  const years: number[] = [];
  for (let y = current; y >= 2025; y--) years.push(y);
  return years;
}
