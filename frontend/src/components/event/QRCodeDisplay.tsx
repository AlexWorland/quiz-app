import { QRCodeSVG } from 'qrcode.react'
import { Lock } from 'lucide-react'

interface QRCodeDisplayProps {
  joinCode: string
  isLocked?: boolean
  size?: number
  showLabel?: boolean
}

export function QRCodeDisplay({
  joinCode,
  isLocked = false,
  size = 256,
  showLabel = true,
}: QRCodeDisplayProps) {
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
  const joinUrl = `${apiUrl}/join?code=${joinCode}`

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {showLabel && (
        <div className="text-xs text-gray-400">Participants can scan to join</div>
      )}
      <div className={`bg-white p-3 rounded-md ${isLocked ? 'opacity-50' : ''}`}>
        <QRCodeSVG
          value={joinUrl}
          size={size}
          bgColor="#ffffff"
          fgColor="#000000"
          level="H"
          includeMargin={true}
        />
      </div>
      {isLocked && (
        <div className="flex items-center gap-1 text-amber-500 text-xs">
          <Lock size={12} />
          Joining locked
        </div>
      )}
      <div className="text-center">
        <div className="text-xs text-gray-500">Join code: </div>
        <div className="text-sm font-mono font-bold text-cyan-400">{joinCode}</div>
      </div>
    </div>
  )
}
