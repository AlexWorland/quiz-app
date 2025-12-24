import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface StatusToastProps {
  message: string
  type: ToastType
  duration?: number
  onClose?: () => void
  className?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function StatusToast({
  message,
  type,
  duration = 5000,
  onClose,
  className = '',
  action
}: StatusToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, 300) // Match exit animation duration
  }

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500/50',
          textColor: 'text-green-300',
          iconColor: 'text-green-400'
        }
      case 'error':
        return {
          icon: <XCircle className="w-5 h-5" />,
          bgColor: 'bg-red-500/20',
          borderColor: 'border-red-500/50',
          textColor: 'text-red-300',
          iconColor: 'text-red-400'
        }
      case 'warning':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          bgColor: 'bg-yellow-500/20',
          borderColor: 'border-yellow-500/50',
          textColor: 'text-yellow-300',
          iconColor: 'text-yellow-400'
        }
      case 'info':
        return {
          icon: <Info className="w-5 h-5" />,
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500/50',
          textColor: 'text-blue-300',
          iconColor: 'text-blue-400'
        }
    }
  }

  if (!isVisible) return null

  const config = getToastConfig()

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md ${
        isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'
      } ${className}`}
    >
      <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 shadow-lg backdrop-blur-sm`}>
        <div className="flex items-start gap-3">
          <div className={config.iconColor}>
            {config.icon}
          </div>
          
          <div className="flex-1">
            <p className={`text-sm ${config.textColor} mb-2`}>
              {message}
            </p>

            {action && (
              <div className="flex gap-2">
                <button
                  onClick={action.onClick}
                  className={`text-xs px-3 py-1 rounded border transition ${
                    type === 'error' 
                      ? 'border-red-500/50 text-red-300 hover:bg-red-500/10'
                      : type === 'warning'
                      ? 'border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/10'
                      : 'border-blue-500/50 text-blue-300 hover:bg-blue-500/10'
                  }`}
                >
                  {action.label}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleClose}
            className={`${config.textColor} opacity-70 hover:opacity-100 transition`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Toast manager for showing multiple status messages
 */
interface ToastMessage {
  id: string
  message: string
  type: ToastType
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface StatusToastManagerProps {
  messages: ToastMessage[]
  onRemove: (id: string) => void
}

export function StatusToastManager({ messages, onRemove }: StatusToastManagerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {messages.map((toast, index) => (
        <div key={toast.id} style={{ top: `${index * 80}px` }}>
          <StatusToast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            action={toast.action}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  )
}

// Add custom CSS for animations in your global CSS or Tailwind config
// .animate-slide-in-right {
//   animation: slideInRight 0.3s ease-out;
// }
// .animate-slide-out-right {
//   animation: slideOutRight 0.3s ease-in;
// }
// @keyframes slideInRight {
//   from { transform: translateX(100%); opacity: 0; }
//   to { transform: translateX(0); opacity: 1; }
// }
// @keyframes slideOutRight {
//   from { transform: translateX(0); opacity: 1; }
//   to { transform: translateX(100%); opacity: 0; }
// }
