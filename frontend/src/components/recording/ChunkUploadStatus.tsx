import { Cloud, Loader } from 'lucide-react'

interface ChunkUploadStatusProps {
  chunksUploaded: number
  isUploading: boolean
}

export function ChunkUploadStatus({ chunksUploaded, isUploading }: ChunkUploadStatusProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      {isUploading ? (
        <>
          <Loader className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Uploading chunk...</span>
        </>
      ) : (
        <>
          <Cloud className="w-4 h-4 text-green-500" />
          <span>{chunksUploaded} chunk{chunksUploaded !== 1 ? 's' : ''} saved</span>
        </>
      )}
    </div>
  )
}

