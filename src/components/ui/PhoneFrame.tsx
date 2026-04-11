interface PhoneFrameProps {
  children: React.ReactNode
}

export default function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="relative animate-float">
      {/* Phone outer shell */}
      <div className="relative w-[280px] h-[560px] bg-gray-900 rounded-[3rem] p-[10px] shadow-2xl shadow-black/30 border border-white/10">
        {/* Dynamic island */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />

        {/* Screen */}
        <div className="w-full h-full bg-white rounded-[2.4rem] overflow-hidden relative">
          {/* Status bar */}
          <div className="h-12 bg-primary flex items-end justify-between px-6 pb-1">
            <span className="text-white/70 text-[10px] font-medium">9:41</span>
            <div className="flex items-center gap-1">
              <span className="text-white/70 text-[10px]">●●●●</span>
              <span className="text-white/70 text-[10px]">🔋</span>
            </div>
          </div>

          {/* App header */}
          <div className="h-11 bg-primary flex items-center px-4 border-b border-primary-light/20">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mr-2">
              <span className="text-white text-[10px] font-bold">B</span>
            </div>
            <span className="text-white text-sm font-semibold">BepoBot</span>
            <span className="ml-auto text-primary-light text-[10px]">online</span>
          </div>

          {/* Chat content */}
          <div className="flex-1 overflow-hidden h-[calc(100%-5.75rem)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
