interface CardField {
  icon: string
  label: string
  value: string
}

interface ChatCardProps {
  title: string
  fields: CardField[]
  animate?: boolean
}

export default function ChatCard({ title, fields, animate = false }: ChatCardProps) {
  return (
    <div className={`flex justify-start ${animate ? 'animate-slide-up' : ''}`}>
      <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0 flex items-center justify-center mr-2 mt-1">
        <span className="text-white text-xs font-bold">B</span>
      </div>
      <div className="max-w-[85%] bg-gray-100 rounded-2xl rounded-bl-md overflow-hidden">
        <div className="px-3.5 py-2 text-sm font-medium text-primary">
          {title}
        </div>
        <div className="bg-white mx-2 mb-2 rounded-xl border border-border">
          {fields.map((field, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 text-xs ${
                i < fields.length - 1 ? 'border-b border-border/50' : ''
              }`}
            >
              <span>{field.icon}</span>
              <span className="text-text-muted">{field.label}</span>
              <span className="ml-auto font-medium text-text">{field.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
