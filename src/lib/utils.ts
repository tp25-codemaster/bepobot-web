export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('hr-HR')}€`
}
