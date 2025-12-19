import { useState, useEffect } from 'react'
import { Upload, Loader } from 'lucide-react'
import { Button } from '@/components/common/Button'

const EMOJI_AVATARS = [
  '😀', '😎', '🤓', '😍', '🥳', '🤔',
  '😴', '🤬', '😤', '🥶', '🤩', '😇',
  '🐶', '🐱', '🦁', '🐼', '🐻', '🦊',
  '🐸', '🐢', '🐧', '🦆', '🦅', '🐢',
]

const UNSPLASH_KEYWORDS = [
  'avatar',
  'portrait',
  'person',
  'profile',
  'headshot',
]

const DEFAULT_STOCK_AVATARS: string[] = [
  'https://avatars.dicebear.com/api/identicon/quiz-1.svg',
  'https://avatars.dicebear.com/api/identicon/quiz-2.svg',
  'https://avatars.dicebear.com/api/identicon/quiz-3.svg',
  'https://avatars.dicebear.com/api/identicon/quiz-4.svg',
  'https://avatars.dicebear.com/api/identicon/quiz-5.svg',
  'https://avatars.dicebear.com/api/identicon/quiz-6.svg',
]

interface AvatarSelectorProps {
  onSelect: (url: string, type: 'emoji' | 'preset' | 'custom', file?: File | null) => void
  loading?: boolean
}

export function AvatarSelector({ onSelect, loading = false }: AvatarSelectorProps) {
  const [tab, setTab] = useState<'emoji' | 'stock' | 'upload'>('emoji')
  const [stockImages, setStockImages] = useState<string[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_AVATARS[0])

  // Call onSelect with default emoji on mount (only once)
  useEffect(() => {
    // Call onSelect with default emoji when component mounts and emoji tab is active
    onSelect(selectedEmoji, 'emoji', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount - onSelect and selectedEmoji are stable

  useEffect(() => {
    if (tab === 'stock') {
      loadStockImages()
    }
  }, [tab])

  const loadStockImages = async () => {
    setLoadingImages(true)
    try {
      const unsplashKey = import.meta.env.VITE_UNSPLASH_KEY

      if (!unsplashKey) {
        // Fallback: built-in stock avatars
        setStockImages(DEFAULT_STOCK_AVATARS)
        return
      }

      const keyword = UNSPLASH_KEYWORDS[Math.floor(Math.random() * UNSPLASH_KEYWORDS.length)]
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${keyword}&per_page=12&client_id=${unsplashKey}`
      )
      const data = await response.json()
      const urls = data.results?.map((img: any) => img.urls.small) || []
      setStockImages(urls.length > 0 ? urls : DEFAULT_STOCK_AVATARS)
    } catch (error) {
      console.error('Failed to load stock images:', error)
      setStockImages(DEFAULT_STOCK_AVATARS)
    } finally {
      setLoadingImages(false)
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji)
    onSelect(emoji, 'emoji', null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // File upload will be handled by parent through API; provide preview URL + file
    onSelect(URL.createObjectURL(file), 'custom', file)
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Choose your avatar *
      </label>

      <div className="flex gap-2 mb-4">
        {(['emoji', 'stock', 'upload'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-accent-cyan text-dark-900'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            }`}
          >
            {t === 'emoji' && '😀 Emoji'}
            {t === 'stock' && '🖼️ Stock'}
            {t === 'upload' && '📁 Upload'}
          </button>
        ))}
      </div>

      {tab === 'emoji' && (
        <div className="grid grid-cols-6 gap-2">
          {EMOJI_AVATARS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiSelect(emoji)}
              className={`text-3xl p-2 rounded-lg transition-all ${
                selectedEmoji === emoji
                  ? 'bg-accent-cyan scale-110'
                  : 'bg-gray-100 dark:bg-gray-700 hover:scale-105'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {tab === 'stock' && (
        <div>
          {loadingImages ? (
            <div className="flex justify-center py-8">
              <Loader className="animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {stockImages.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelect(url, 'preset')}
                  className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-accent-cyan transition-all"
                >
                  <img src={url} alt="avatar" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <Button
            onClick={loadStockImages}
            variant="secondary"
            size="sm"
            className="mt-4 w-full"
            disabled={loadingImages}
          >
            Load more
          </Button>
        </div>
      )}

      {tab === 'upload' && (
        <label className="block">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-accent-cyan cursor-pointer transition-colors">
            <Upload className="mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click to upload or drag and drop
            </p>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={loading}
          />
        </label>
      )}
    </div>
  )
}
