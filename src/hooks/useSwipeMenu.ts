import { useRef, useCallback, useEffect, useState } from 'react'

interface UseSwipeMenuOptions {
  onOpen: () => void
  onClose: () => void
  isOpen: boolean
}

export function useSwipeMenu({ onOpen, onClose, isOpen }: UseSwipeMenuOptions) {
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchCurrentX = useRef(0)
  const isSwiping = useRef(false)
  const [drawerOffset, setDrawerOffset] = useState(0)

  // Edge swipe to open (touch starts within 30px of left edge)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const x = e.touches[0].clientX
    const y = e.touches[0].clientY
    touchStartX.current = x
    touchStartY.current = y
    touchCurrentX.current = x

    // Only start swipe-to-open if touch begins near left edge and menu is closed
    if (!isOpen && x < 30) {
      isSwiping.current = true
    }
    // Swipe-to-close when menu is open
    if (isOpen) {
      isSwiping.current = true
    }
  }, [isOpen])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwiping.current) return

    const x = e.touches[0].clientX
    const y = e.touches[0].clientY
    touchCurrentX.current = x

    // Ignore vertical swipes
    const dx = Math.abs(x - touchStartX.current)
    const dy = Math.abs(y - touchStartY.current)
    if (dy > dx * 1.5) {
      isSwiping.current = false
      setDrawerOffset(0)
      return
    }

    if (!isOpen) {
      // Opening: offset goes from -288 (closed) towards 0 (open)
      const drag = Math.min(x - touchStartX.current, 288)
      if (drag > 0) setDrawerOffset(-288 + drag)
    } else {
      // Closing: offset goes from 0 (open) towards -288 (closed)
      const drag = touchStartX.current - x
      if (drag > 0) setDrawerOffset(-Math.min(drag, 288))
    }
  }, [isOpen])

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return
    isSwiping.current = false

    const dx = touchCurrentX.current - touchStartX.current

    if (!isOpen && dx > 80) {
      onOpen()
    } else if (isOpen && dx < -80) {
      onClose()
    }
    setDrawerOffset(0)
  }, [isOpen, onOpen, onClose])

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return { drawerOffset }
}
