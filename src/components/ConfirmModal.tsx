interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Potvrdi',
  cancelLabel = 'Odustani',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[88%] max-w-sm z-50 overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h2
            id="confirm-modal-title"
            className="text-base font-bold text-text"
          >
            {title}
          </h2>
          <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 text-text-muted text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
              danger
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-primary text-white hover:bg-primary/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
