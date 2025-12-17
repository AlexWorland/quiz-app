import { useEffect, useRef } from 'react'

interface TranscriptViewProps {
  transcript: string
  isLive?: boolean
}

export function TranscriptView({ transcript, isLive = false }: TranscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && isLive) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript, isLive])

  return (
    <div className="bg-dark-800 rounded-lg p-4 h-64 overflow-y-auto" ref={scrollRef}>
      {transcript ? (
        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{transcript}</p>
      ) : (
        <p className="text-gray-500 italic">No transcript yet. Start recording to see live transcription.</p>
      )}
    </div>
  )
}

