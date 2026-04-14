import { useRef, useCallback, useEffect } from 'react'

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
  const isEdgeSwipe = useRef(false)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const x = e.touches[0].clientX
    const y = e.touches[0].clientY
    touchStartX.current = x
    touchStartY.current = y
    touchCurrentX.current = x
    isEdgeSwipe.current = false

    // Edge swipe to open (touch starts within 25px of left edge)
    if (!isOpen && x < 25) {
      isSwiping.current = true
      isEdgeSwipe.current = true
      // Block iOS back gesture by preventing default
      e.preventDefault()
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
      return
    }

    // Prevent browser back gesture during our swipe
    if (isEdgeSwipe.current) {
      e.preventDefault()
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return
    isSwiping.current = false
    isEdgeSwipe.current = false

    const dx = touchCurrentX.current - touchStartX.current

    if (!isOpen && dx > 60) {
      onOpen()
    } else if (isOpen && dx < -60) {
      onClose()
    }
  }, [isOpen, onOpen, onClose])

  useEffect(() => {
    // MUST use passive: false for touchstart/touchmove to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])
}
