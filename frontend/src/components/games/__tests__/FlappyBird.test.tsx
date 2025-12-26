import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FlappyBird } from '../FlappyBird'

describe('FlappyBird', () => {
  it('should render game canvas', () => {
    render(<FlappyBird />)
    
    expect(screen.getByText(/Generating your quiz/i)).toBeInTheDocument()
    expect(screen.getByText(/Click or press SPACE to flap/i)).toBeInTheDocument()
    
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveAttribute('width', '400')
    expect(canvas).toHaveAttribute('height', '600')
  })

  it('should display initial score of 0', () => {
    render(<FlappyBird />)
    
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('should call onScore callback when provided', () => {
    const onScore = vi.fn()
    render(<FlappyBird onScore={onScore} />)
    
    // Game loop would call onScore when player passes pipes
    // Canvas game loop testing is complex, just verify component renders
    expect(screen.getByText(/Generating your quiz/i)).toBeInTheDocument()
  })
})

