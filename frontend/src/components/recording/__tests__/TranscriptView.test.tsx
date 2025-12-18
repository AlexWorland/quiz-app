import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TranscriptView } from '../TranscriptView'

describe('TranscriptView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display transcript text when provided', () => {
    const transcript = 'This is a test transcript'
    render(<TranscriptView transcript={transcript} />)
    expect(screen.getByText(transcript)).toBeInTheDocument()
  })

  it('should show placeholder message when transcript is empty', () => {
    render(<TranscriptView transcript="" />)
    expect(
      screen.getByText('No transcript yet. Start recording to see live transcription.')
    ).toBeInTheDocument()
  })

  it('should have overflow-y-auto class for scrolling', () => {
    const { container } = render(<TranscriptView transcript="test" />)
    const scrollContainer = container.querySelector('.overflow-y-auto')
    expect(scrollContainer).toBeInTheDocument()
  })

  it('should have bg-dark-800 background class', () => {
    const { container } = render(<TranscriptView transcript="test" />)
    const transcriptDiv = container.querySelector('.bg-dark-800')
    expect(transcriptDiv).toBeInTheDocument()
  })

  it('should have rounded-lg and p-4 classes', () => {
    const { container } = render(<TranscriptView transcript="test" />)
    const transcriptDiv = container.querySelector('.rounded-lg.p-4')
    expect(transcriptDiv).toBeInTheDocument()
  })

  it('should have h-64 height class', () => {
    const { container } = render(<TranscriptView transcript="test" />)
    const transcriptDiv = container.querySelector('.h-64')
    expect(transcriptDiv).toBeInTheDocument()
  })

  it('should format transcript with whitespace-pre-wrap', () => {
    const transcript = 'Line 1\nLine 2\n  Indented'
    const { container } = render(<TranscriptView transcript={transcript} />)
    const textElement = container.querySelector('.whitespace-pre-wrap')
    expect(textElement).toBeInTheDocument()
    expect(textElement?.textContent).toBe(transcript)
  })

  it('should render with isLive true', () => {
    const transcript = 'Initial transcript'
    render(<TranscriptView transcript={transcript} isLive={true} />)
    expect(screen.getByText(transcript)).toBeInTheDocument()
  })

  it('should render with isLive false', () => {
    const transcript = 'Initial transcript'
    render(<TranscriptView transcript={transcript} isLive={false} />)
    expect(screen.getByText(transcript)).toBeInTheDocument()
  })

  it('should default isLive to false when not provided', () => {
    const transcript = 'Initial transcript'
    render(<TranscriptView transcript={transcript} />)
    expect(screen.getByText(transcript)).toBeInTheDocument()
  })

  it('should display text with gray-300 color class', () => {
    const transcript = 'This is a test transcript'
    render(<TranscriptView transcript={transcript} />)
    const textElement = screen.getByText(transcript)
    expect(textElement).toHaveClass('text-gray-300')
  })

  it('should display placeholder with gray-500 and italic classes', () => {
    render(<TranscriptView transcript="" />)
    const placeholderElement = screen.getByText('No transcript yet. Start recording to see live transcription.')
    expect(placeholderElement).toHaveClass('text-gray-500')
    expect(placeholderElement).toHaveClass('italic')
  })
})
