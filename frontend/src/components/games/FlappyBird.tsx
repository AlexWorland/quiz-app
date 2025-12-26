import { useEffect, useRef, useState } from 'react'

interface FlappyBirdProps {
  onScore?: (score: number) => void
}

export function FlappyBird({ onScore }: FlappyBirdProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const GRAVITY = 0.5
    const JUMP = -10
    const PIPE_SPEED = 3
    const PIPE_GAP = 150
    const PIPE_WIDTH = 60

    let bird = { x: 100, y: canvas.height / 2, velocity: 0, radius: 15 }
    let pipes: Array<{ x: number; topHeight: number; scored?: boolean }> = []
    let frameCount = 0
    let currentScore = 0

    const handleJump = () => {
      if (gameOver) {
        bird = { x: 100, y: canvas.height / 2, velocity: 0, radius: 15 }
        pipes = []
        frameCount = 0
        currentScore = 0
        setScore(0)
        setGameOver(false)
      } else {
        bird.velocity = JUMP
      }
    }

    canvas.addEventListener('click', handleJump)
    const keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleJump()
      }
    }
    window.addEventListener('keydown', keyHandler)

    const gameLoop = () => {
      if (gameOver) return

      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      bird.velocity += GRAVITY
      bird.y += bird.velocity

      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.arc(bird.x, bird.y, bird.radius, 0, Math.PI * 2)
      ctx.fill()

      if (frameCount % 90 === 0) {
        const topHeight = Math.random() * (canvas.height - PIPE_GAP - 100) + 50
        pipes.push({ x: canvas.width, topHeight })
      }

      for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i]
        pipe.x -= PIPE_SPEED

        ctx.fillStyle = '#10b981'
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight)
        
        const bottomY = pipe.topHeight + PIPE_GAP
        ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, canvas.height - bottomY)

        if (pipe.x + PIPE_WIDTH < bird.x && !pipe.scored) {
          pipe.scored = true
          currentScore++
          setScore(currentScore)
          onScore?.(currentScore)
        }

        const hitTop = bird.y - bird.radius < pipe.topHeight && 
                       bird.x + bird.radius > pipe.x && 
                       bird.x - bird.radius < pipe.x + PIPE_WIDTH

        const hitBottom = bird.y + bird.radius > pipe.topHeight + PIPE_GAP && 
                          bird.x + bird.radius > pipe.x && 
                          bird.x - bird.radius < pipe.x + PIPE_WIDTH

        if (hitTop || hitBottom) {
          setGameOver(true)
          return
        }

        if (pipe.x + PIPE_WIDTH < 0) {
          pipes.splice(i, 1)
        }
      }

      if (bird.y + bird.radius > canvas.height || bird.y - bird.radius < 0) {
        setGameOver(true)
        return
      }

      frameCount++
      requestAnimationFrame(gameLoop)
    }

    gameLoop()

    return () => {
      canvas.removeEventListener('click', handleJump)
      window.removeEventListener('keydown', keyHandler)
    }
  }, [gameOver, onScore])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">
          Generating your quiz...
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Play while you wait! Click or press SPACE to flap
        </p>
      </div>
      
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={600}
          className="border-2 border-cyan-500 rounded-lg"
        />
        
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/50 px-4 py-2 rounded-lg">
          <span className="text-2xl font-bold text-white">{score}</span>
        </div>
        
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
            <div className="text-center">
              <h4 className="text-2xl font-bold text-white mb-2">Game Over!</h4>
              <p className="text-gray-300 mb-4">Score: {score}</p>
              <p className="text-sm text-gray-400">Click to restart</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

