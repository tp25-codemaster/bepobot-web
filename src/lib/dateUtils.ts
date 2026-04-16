/**
 * Shared date and format utility functions.
 * Used across DashboardPage, RezervacijePage, GostiPage, etc.
 */

/**
 * Format a date string (YYYY-MM-DD or ISO) to hr-HR locale with day and month.
 * Example: "2024-07-15" → "15.07."
 */
export function formatDateShort(s: string): string {
  return new Date(s).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit' })
}

/**
 * Format a date string to hr-HR locale with day, month, and year.
 * Handles date-only strings by appending T00:00:00 to avoid timezone shift.
 * Example: "2024-07-15" → "15.07.2024."
 */
export function formatDate(s: string | null): string {
  if (!s) return '-'
  // Append time to avoid timezone offset on date-only strings
  const d = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00')
  return d.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Calculate the number of nights between two date strings (YYYY-MM-DD).
 * Returns 0 if either argument is falsy or result would be negative.
 */
export function nights(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0
  return Math.max(0, Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  ))
}

/**
 * Return a time-of-day greeting in Croatian.
 */
export function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Dobro jutro'
  if (h < 18) return 'Dobar dan'
  return 'Dobra večer'
}

/**
 * Format a date string relative to today: "Danas", "Sutra", or formatted date.
 * Example: today → "Danas", tomorrow → "Sutra", else "15.07."
 */
export function formatDateRelative(s: string): string {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (s === today) return 'Danas'
  if (s === tomorrow) return 'Sutra'
  return formatDateShort(s)
}
