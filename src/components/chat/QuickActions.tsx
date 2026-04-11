interface QuickActionsProps {
  actions: string[]
  onAction: (action: string) => void
}

export default function QuickActions({ actions, onAction }: QuickActionsProps) {
  return (
    <div className="flex justify-start animate-slide-up">
      <div className="w-7 flex-shrink-0 mr-2" /> {/* Avatar spacer */}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            onClick={() => onAction(action)}
            className="px-3.5 py-2 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20 hover:bg-primary/20 active:scale-95 transition-all cursor-pointer"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}
