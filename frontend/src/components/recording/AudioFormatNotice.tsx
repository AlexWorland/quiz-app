import type { AudioCapabilities } from '@/hooks/useAudioWebSocket'

interface AudioFormatNoticeProps {
  capabilities: AudioCapabilities | null
  error?: string | null
}

export function AudioFormatNotice({ capabilities, error }: AudioFormatNoticeProps) {
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mb-4">
        <div className="font-semibold">Audio recording unavailable</div>
        <div>{error}</div>
      </div>
    )
  }

  if (!capabilities || capabilities.isOptimal) {
    return null
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 text-yellow-400 text-sm mb-4">
      <div className="font-semibold">Recording fallback format in use</div>
      <div>
        Using {capabilities.mimeType}. {capabilities.warning || 'Recording quality may be reduced.'} For the best
        quality and lowest bandwidth, use a browser that supports WebM/Opus.
      </div>
    </div>
  )
}
