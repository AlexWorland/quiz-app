import { useEffect, useState } from 'react'
import { FileText, AlertTriangle, Info, CheckCircle } from 'lucide-react'

interface ProcessingLog {
  stage: string
  message: string
  level: string
  created_at: string
}

interface ProcessingLogsProps {
  segmentId: string
  isOpen: boolean
  onClose: () => void
}

export function ProcessingLogs({ segmentId, isOpen, onClose }: ProcessingLogsProps) {
  const [logs, setLogs] = useState<ProcessingLog[]>([])
  
  useEffect(() => {
    if (!isOpen) return
    
    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        const response = await fetch(`/api/segments/${segmentId}/processing-logs`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setLogs(data)
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error)
      }
    }
    
    fetchLogs()
    const interval = setInterval(fetchLogs, 2000) // Poll every 2s
    
    return () => clearInterval(interval)
  }, [segmentId, isOpen])
  
  if (!isOpen) return null
  
  const getIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'info': return <Info className="w-4 h-4 text-cyan-500" />
      default: return <CheckCircle className="w-4 h-4 text-green-500" />
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-900 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Processing Logs
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-2xl leading-none"
          >
            ×
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2">
          {logs.map((log, idx) => (
            <div
              key={idx}
              className="bg-dark-800 rounded p-3 flex items-start gap-3"
            >
              {getIcon(log.level)}
              <div className="flex-1">
                <div className="text-white font-medium capitalize">{log.stage.replace('_', ' ')}</div>
                <div className="text-gray-400 text-sm">{log.message}</div>
                <div className="text-gray-500 text-xs mt-1">
                  {new Date(log.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-gray-400 text-center py-8">
              No processing logs yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

