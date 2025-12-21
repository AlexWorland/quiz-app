import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import type { AudioCapabilities } from '@/hooks/useAudioWebSocket'
import { AudioFormatNotice } from '../AudioFormatNotice'

describe('AudioFormatNotice', () => {
  it('renders nothing when capabilities are optimal', () => {
    const capabilities: AudioCapabilities = { mimeType: 'audio/webm;codecs=opus', isOptimal: true }
    const { container } = render(<AudioFormatNotice capabilities={capabilities} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows fallback warning when using a non-optimal format', () => {
    const capabilities: AudioCapabilities = {
      mimeType: 'audio/wav',
      isOptimal: false,
      warning: 'Using WAV format (no compression, very high bandwidth)',
    }

    render(<AudioFormatNotice capabilities={capabilities} />)

    expect(screen.getByText('Recording fallback format in use')).toBeInTheDocument()
    expect(screen.getByText(/Using audio\/wav/)).toBeInTheDocument()
    expect(screen.getByText(/Recording quality may be reduced|WAV format/)).toBeInTheDocument()
  })

  it('shows error state when provided', () => {
    render(<AudioFormatNotice capabilities={null} error="mic failure" />)

    expect(screen.getByText('Audio recording unavailable')).toBeInTheDocument()
    expect(screen.getByText('mic failure')).toBeInTheDocument()
  })
})
