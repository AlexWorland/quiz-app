import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AvatarSelector } from '../AvatarSelector'

describe('AvatarSelector', () => {
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render emoji tab by default', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />)

    const emojiButton = screen.getByRole('button', { name: /emoji/i })
    expect(emojiButton).toHaveClass('bg-accent-cyan')
  })

  it('should display all emoji options', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />)

    expect(screen.getByText('😀')).toBeInTheDocument()
    expect(screen.getByText('😎')).toBeInTheDocument()
    expect(screen.getByText('🐶')).toBeInTheDocument()
  })

  it('should call onSelect with emoji when emoji is clicked', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />)

    fireEvent.click(screen.getByText('😎'))

    expect(mockOnSelect).toHaveBeenCalledWith('😎', 'emoji', null)
  })

  it('should highlight selected emoji', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />)

    const emojiButton = screen.getByText('😎')
    fireEvent.click(emojiButton)

    expect(emojiButton).toHaveClass('bg-accent-cyan')
  })

  it('should switch to stock tab when clicked', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /stock/i }))

    const stockButton = screen.getByRole('button', { name: /stock/i })
    expect(stockButton).toHaveClass('bg-accent-cyan')
  })

  it('should switch to upload tab when clicked', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /upload/i }))

    expect(screen.getByText(/click to upload/i)).toBeInTheDocument()
  })

  it('should call onSelect with file when file is uploaded', async () => {
    const mockCreateObjectURL = vi.fn(() => 'blob:test-url')
    global.URL.createObjectURL = mockCreateObjectURL

    render(<AvatarSelector onSelect={mockOnSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /upload/i }))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.png', { type: 'image/png' })

    Object.defineProperty(input, 'files', {
      value: [file],
    })

    fireEvent.change(input)

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith('blob:test-url', 'custom', file)
    })
  })

  it('should display label text', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />)

    expect(screen.getByText(/choose your avatar/i)).toBeInTheDocument()
  })

  it('should disable file input when loading', () => {
    render(<AvatarSelector onSelect={mockOnSelect} loading={true} />)

    fireEvent.click(screen.getByRole('button', { name: /upload/i }))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('should show default emoji selected initially', () => {
    render(<AvatarSelector onSelect={mockOnSelect} />)

    const firstEmoji = screen.getByText('😀')
    expect(firstEmoji).toHaveClass('bg-accent-cyan')
  })
})
