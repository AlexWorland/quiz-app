import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  trigger?: 'hover' | 'click'
  className?: string
  delay?: number
}

export function Tooltip({
  content,
  children,
  position = 'top',
  trigger = 'hover',
  className = '',
  delay = 300
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    
    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        break
      case 'bottom':
        top = triggerRect.bottom + 8
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        break
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.left - tooltipRect.width - 8
        break
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.right + 8
        break
    }

    // Keep tooltip within viewport
    const padding = 8
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding))
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding))

    setTooltipPosition({ top, left })
  }

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    if (trigger === 'hover' && delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true)
      }, delay)
    } else {
      setIsVisible(true)
    }
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    if (trigger === 'hover') {
      setIsVisible(false)
    }
  }

  const toggleTooltip = () => {
    if (trigger === 'click') {
      setIsVisible(!isVisible)
    }
  }

  useEffect(() => {
    if (isVisible) {
      calculatePosition()
    }
  }, [isVisible, position])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (trigger === 'click' && 
          tooltipRef.current && 
          !tooltipRef.current.contains(event.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(event.target as Node)) {
        setIsVisible(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsVisible(false)
      }
    }

    const handleResize = () => {
      if (isVisible) {
        calculatePosition()
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      window.addEventListener('resize', handleResize)
      window.addEventListener('scroll', handleResize)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isVisible, trigger])

  const tooltipElement = isVisible && (
    <div
      ref={tooltipRef}
      className={`fixed z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg border border-gray-700 max-w-xs break-words ${className}`}
      style={{
        top: tooltipPosition.top,
        left: tooltipPosition.left,
      }}
      role="tooltip"
    >
      {content}
      <div 
        className={`absolute w-2 h-2 bg-gray-900 border-gray-700 transform rotate-45 ${
          position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-r border-b' :
          position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2 border-l border-t' :
          position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2 border-t border-r' :
          'left-[-4px] top-1/2 -translate-y-1/2 border-b border-l'
        }`}
      />
    </div>
  )

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={trigger === 'hover' ? showTooltip : undefined}
        onMouseLeave={trigger === 'hover' ? hideTooltip : undefined}
        onClick={trigger === 'click' ? toggleTooltip : undefined}
        className="inline-block cursor-help"
      >
        {children}
      </div>
      {typeof document !== 'undefined' && createPortal(tooltipElement, document.body)}
    </>
  )
}
