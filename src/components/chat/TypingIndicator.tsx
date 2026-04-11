export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0 flex items-center justify-center mr-2 mt-1">
        <span className="text-white text-xs font-bold">B</span>
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-text-muted/50 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-text-muted/50 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-text-muted/50 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}
