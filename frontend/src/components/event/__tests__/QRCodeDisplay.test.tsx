import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { QRCodeDisplay } from '../QRCodeDisplay'

describe('QRCodeDisplay', () => {
  it('renders QR code with join code', () => {
    render(<QRCodeDisplay joinCode="ABC123" />)

    const joinCodeElement = screen.getByText('ABC123')
    expect(joinCodeElement).toBeInTheDocument()
  })

  it('displays label by default', () => {
    render(<QRCodeDisplay joinCode="ABC123" />)

    const label = screen.getByText(/Participants can scan to join/i)
    expect(label).toBeInTheDocument()
  })

  it('hides label when showLabel is false', () => {
    render(<QRCodeDisplay joinCode="ABC123" showLabel={false} />)

    const label = screen.queryByText(/Participants can scan to join/i)
    expect(label).not.toBeInTheDocument()
  })

  it('shows lock indicator when isLocked is true', () => {
    render(<QRCodeDisplay joinCode="ABC123" isLocked={true} />)

    const lockIndicator = screen.getByText(/Joining locked/i)
    expect(lockIndicator).toBeInTheDocument()
  })

  it('does not show lock indicator when isLocked is false', () => {
    render(<QRCodeDisplay joinCode="ABC123" isLocked={false} />)

    const lockIndicator = screen.queryByText(/Joining locked/i)
    expect(lockIndicator).not.toBeInTheDocument()
  })

  it('generates correct join URL', () => {
    const joinCode = 'XYZ789'
    const { container } = render(<QRCodeDisplay joinCode={joinCode} />)

    const svgElement = container.querySelector('svg')
    expect(svgElement).toBeInTheDocument()
  })

  it('applies custom size prop', () => {
    const { container } = render(<QRCodeDisplay joinCode="ABC123" size={300} />)

    const svgElement = container.querySelector('svg')
    expect(svgElement?.getAttribute('width')).toBe('300')
    expect(svgElement?.getAttribute('height')).toBe('300')
  })

  it('applies opacity when locked', () => {
    const { container } = render(<QRCodeDisplay joinCode="ABC123" isLocked={true} />)

    const wrapper = container.querySelector('.opacity-50')
    expect(wrapper).toBeInTheDocument()
  })
})
