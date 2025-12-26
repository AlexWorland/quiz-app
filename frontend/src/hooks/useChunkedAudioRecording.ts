import { useState, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

const CHUNK_DURATION_MS = 60000  // 1 minute
const LOSSY_BITRATE = 48000  // 48 kbps for speech

export interface ChunkUploadResult {
  chunkIndex: number
  success: boolean
  error?: string
}

interface UseChunkedRecordingOptions {
  segmentId: string
  onChunkUploaded?: (result: ChunkUploadResult) => void
  onError?: (error: string) => void
}

export function useChunkedAudioRecording({
  segmentId,
  onChunkUploaded,
  onError
}: UseChunkedRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false)
  const [chunksUploaded, setChunksUploaded] = useState<number>(0)
  const [uploadingChunk, setUploadingChunk] = useState(false)
  const token = useAuthStore((state) => state.token)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunkIndexRef = useRef(0)

  const uploadChunk = useCallback(async (chunkBlob: Blob, chunkIndex: number, retryCount = 0) => {
    const MAX_RETRIES = 3
    setUploadingChunk(true)
    
    try {
      const formData = new FormData()
      formData.append('audio_chunk', chunkBlob, `chunk_${chunkIndex}.webm`)
      
      const response = await fetch(
        `/api/segments/${segmentId}/audio-chunk?chunk_index=${chunkIndex}`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
      
      if (!response.ok) {
        throw new Error(`Chunk upload failed: ${response.statusText}`)
      }
      
      const result = await response.json()
      setChunksUploaded(prev => prev + 1)
      onChunkUploaded?.({ chunkIndex, success: true })
      
      return result
    } catch (error) {
      // Retry logic with exponential backoff
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying chunk ${chunkIndex}, attempt ${retryCount + 1}`)
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)))
        return uploadChunk(chunkBlob, chunkIndex, retryCount + 1)
      }
      
      // Max retries exceeded
      const errorMsg = error instanceof Error ? error.message : 'Upload failed'
      onChunkUploaded?.({ chunkIndex, success: false, error: errorMsg })
      onError?.(errorMsg)
      throw error
    } finally {
      setUploadingChunk(false)
    }
  }, [segmentId, token, onChunkUploaded, onError])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: LOSSY_BITRATE  // Lossy compression for bandwidth
      })

      chunkIndexRef.current = 0

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Upload chunk immediately
          try {
            await uploadChunk(event.data, chunkIndexRef.current)
            chunkIndexRef.current++
          } catch (error) {
            console.error('Failed to upload chunk:', error)
            // Continue recording even if upload fails
            // Chunk will be lost but recording continues
          }
        }
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
      }

      // Request chunk every 1 minute
      mediaRecorder.start(CHUNK_DURATION_MS)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setChunksUploaded(0)
    } catch (err) {
      const errorMsg = 'Microphone access denied or not available'
      onError?.(errorMsg)
      throw err
    }
  }, [uploadChunk, onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  return {
    isRecording,
    chunksUploaded,
    uploadingChunk,
    startRecording,
    stopRecording,
  }
}

