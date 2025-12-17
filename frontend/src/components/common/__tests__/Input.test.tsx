import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '../Input'

describe('Input', () => {
  it('should render input element', () => {
    render(<Input />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should render label when provided', () => {
    render(<Input label="Username" />)

    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('should not render label when not provided', () => {
    render(<Input />)

    expect(screen.queryByRole('label')).not.toBeInTheDocument()
  })

  it('should display error message when provided', () => {
    render(<Input error="This field is required" />)

    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('should apply error styling to input when error is present', () => {
    render(<Input error="Error" />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('border-red-500')
  })

  it('should apply error styling to focus ring when error is present', () => {
    render(<Input error="Error" />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('focus:ring-red-500')
  })

  it('should display error message in red', () => {
    render(<Input error="Error message" />)

    const errorMessage = screen.getByText('Error message')
    expect(errorMessage).toHaveClass('text-red-500')
  })

  it('should forward ref to input', () => {
    const ref = vi.fn()
    render(<Input ref={ref} />)

    expect(ref).toHaveBeenCalled()
  })

  it('should handle onChange events', () => {
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })

    expect(handleChange).toHaveBeenCalled()
  })

  it('should apply custom className', () => {
    render(<Input className="custom-class" />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-class')
  })

  it('should pass through input attributes', () => {
    render(<Input placeholder="Enter text" type="email" />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('placeholder', 'Enter text')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('should apply disabled styling', () => {
    render(<Input disabled />)

    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })

  it('should have proper base styling', () => {
    render(<Input />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('w-full', 'px-4', 'py-2', 'rounded-lg')
  })

  it('should associate label with input', () => {
    render(<Input label="Email" id="email-input" />)

    const label = screen.getByText('Email')
    expect(label).toBeInTheDocument()
  })
})
