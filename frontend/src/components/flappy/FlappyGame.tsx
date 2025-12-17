import { useEffect, useRef, useState, useCallback } from 'react'
import type { Participant } from '@/hooks/useEventWebSocket'

interface FlappyGameProps {
  participants: Participant[]
  currentUserId?: string
}

interface BirdState {
  id: string
  username: string
  avatar_url?: string
  color: string
  // vertical position: 0 = top, 1 = bottom
  y: number
  // vertical velocity
  vy: number
  alive: boolean
}

const GRAVITY = 0.0018 // per ms
const FLAP_VELOCITY = -0.04
const FLOOR_Y = 0.95
const CEIL_Y = 0.05

export function FlappyGame({ participants, currentUserId }: FlappyGameProps) {
  const [birds, setBirds] = useState<BirdState[]>([])
  const lastTimeRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  // Sync bird list with participants
  useEffect(() => {
    setBirds((prev) => {
      const map = new Map(prev.map((b) => [b.id, b]))
      const next: BirdState[] = participants.map((p, index) => {
        const existing = map.get(p.id)
        return (
          existing ?? {
            id: p.id,
            username: p.username,
            avatar_url: p.avatar_url,
            color: colors[index % colors.length],
            y: 0.5,
            vy: 0,
            alive: true,
          }
        )
      })
      return next
    })
  }, [participants])

  const flap = useCallback(() => {
    if (!currentUserId) return
    setBirds((prev) =>
      prev.map((b) =>
        b.id === currentUserId && b.alive
          ? { ...b, vy: FLAP_VELOCITY }
          : b
      )
    )
  }, [currentUserId])

  // Keyboard + click controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [flap])

  const gameLoop = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = timestamp
        frameRef.current = requestAnimationFrame(gameLoop)
        return
      }

      const dt = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      setBirds((prev) =>
        prev.map((b) => {
          if (!b.alive) return b
          let vy = b.vy + GRAVITY * dt
          let y = b.y + vy * dt

          if (y > FLOOR_Y) {
            y = FLOOR_Y
            vy = 0
          }
          if (y < CEIL_Y) {
            y = CEIL_Y
            vy = 0
          }

          return { ...b, y, vy }
        })
      )

      frameRef.current = requestAnimationFrame(gameLoop)
    },
    []
  )

  useEffect(() => {
    frameRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    }
  }, [gameLoop])

  if (birds.length === 0) {
    return (
      <div className="bg-dark-900 rounded-lg p-6 border border-dashed border-dark-700 text-center">
        <p className="text-gray-400 mb-2">Waiting for players to join...</p>
        <p className="text-xs text-gray-500">
          Once players join, you&apos;ll see all birds flying together here.
        </p>
      </div>
    )
  }

  return (
    <div
      className="bg-dark-900 rounded-lg p-4 border border-dark-700 overflow-hidden relative h-56 cursor-pointer"
      onClick={flap}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-sky-900/60 to-emerald-900/60" />
      <div className="relative z-10 h-full flex flex-col justify-evenly">
        {birds.map((bird) => (
          <div key={bird.id} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold absolute left-4 transition-transform duration-100"
              style={{ backgroundColor: bird.color }}
            >
              {bird.avatar_url ? (
                <img
                  src={bird.avatar_url}
                  alt={bird.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-white">
                  {bird.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 h-2 bg-dark-800 rounded-full overflow-hidden ml-16">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 animate-[flap_3s_linear_infinite]"
              />
            </div>
            <div className="w-24 text-xs text-gray-200 truncate ml-2">
              {bird.username}
            </div>
          </div>
        ))}
      </div>
      <style>
        {`
          @keyframes flap {
            0% { transform: translateX(-10%); }
            50% { transform: translateX(50%); }
            100% { transform: translateX(110%); }
          }
        `}
      </style>
    </div>
  )
}

const colors = [
  '#F97316', // orange
  '#22C55E', // green
  '#3B82F6', // blue
  '#EAB308', // yellow
  '#EC4899', // pink
  '#8B5CF6', // violet
]
