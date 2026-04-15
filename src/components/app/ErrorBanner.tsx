interface ErrorBannerProps {
  message: string
  onDismiss?: () => void
  onRetry?: () => void
  variant?: 'error' | 'warning' | 'info'
}

const VARIANTS = {
  error: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-orange-50 border-orange-200 text-orange-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
}

const ICONS = {
  error: '⚠️',
  warning: '⚠️',
  info: 'ℹ️',
}

export default function ErrorBanner({
  message,
  onDismiss,
  onRetry,
  variant = 'error',
}: ErrorBannerProps) {
  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${VARIANTS[variant]}`}
    >
      <span className="flex-shrink-0 text-base leading-none mt-0.5">{ICONS[variant]}</span>
      <div className="flex-1 min-w-0">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex-shrink-0 text-xs font-semibold underline hover:no-underline"
        >
          Pokusaj ponovo
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-base leading-none opacity-60 hover:opacity-100"
          aria-label="Zatvori"
        >
          ×
        </button>
      )}
    </div>
  )
}
