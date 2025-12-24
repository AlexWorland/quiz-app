import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPresenterSelect } from '../AdminPresenterSelect'
import { act } from 'react'

describe('AdminPresenterSelect', () => {
  const mockOnSelect = vi.fn()
  const segmentId = 'segment-123'

  const mockParticipants = [
    { id: 'p1', username: 'Alice', avatar_url: 'https://example.com/alice.jpg', is_connected: true },
    { id: 'p2', username: 'Bob', avatar_url: undefined, is_connected: true },
    { id: 'p3', username: 'Charlie', avatar_url: 'https://example.com/charlie.jpg', is_connected: false },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render assign presenter button', () => {
    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByRole('button', { name: /Assign Presenter/i })).toBeInTheDocument()
  })

  it('should show participants when button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    const button = screen.getByRole('button', { name: /Assign Presenter/i })
    await user.click(button)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('should call onSelect when connected participant is clicked', async () => {
    const user = userEvent.setup()

    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    const button = screen.getByRole('button', { name: /Assign Presenter/i })
    await user.click(button)

    const aliceButton = screen.getByRole('button', { name: /Alice/i })
    await user.click(aliceButton)

    expect(mockOnSelect).toHaveBeenCalledWith('p1', segmentId)
  })

  it('should show error when disconnected participant is selected', async () => {
    const user = userEvent.setup()

    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    const assignButton = screen.getByRole('button', { name: /Assign Presenter/i })
    await user.click(assignButton)

    // Find all buttons and click the one with Charlie text
    const buttons = screen.getAllByRole('button')
    const charlieButton = buttons.find(btn => btn.textContent?.includes('Charlie'))
    expect(charlieButton).toBeDefined()
    await user.click(charlieButton!)

    await waitFor(() => {
      expect(screen.getByText(/Charlie is disconnected and cannot be selected/i)).toBeInTheDocument()
    })

    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('should hide error after 3 seconds', async () => {
    vi.useFakeTimers()

    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    const button = screen.getByRole('button', { name: /Assign Presenter/i })
    fireEvent.click(button)

    const buttons = screen.getAllByRole('button')
    const charlieButton = buttons.find(btn => btn.textContent?.includes('Charlie'))
    expect(charlieButton).toBeDefined()
    fireEvent.click(charlieButton!)

    expect(screen.getByText(/Charlie is disconnected/i)).toBeInTheDocument()

    // Fast forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByText(/Charlie is disconnected/i)).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('should close dropdown after successful selection', () => {
    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    const button = screen.getByRole('button', { name: /Assign Presenter/i })
    fireEvent.click(button)

    const buttons = screen.getAllByRole('button')
    const aliceButton = buttons.find(btn => btn.textContent?.includes('Alice'))
    fireEvent.click(aliceButton!)

    // Dropdown should close after selection
    expect(screen.queryByText('Select new presenter:')).not.toBeInTheDocument()
  })

  it('should keep dropdown open after selecting disconnected participant', () => {
    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    const button = screen.getByRole('button', { name: /Assign Presenter/i })
    fireEvent.click(button)

    const buttons = screen.getAllByRole('button')
    const charlieButton = buttons.find(btn => btn.textContent?.includes('Charlie'))
    fireEvent.click(charlieButton!)

    expect(screen.getByText(/Charlie is disconnected/i)).toBeInTheDocument()

    // Dropdown should still be open
    expect(screen.getByText('Select new presenter:')).toBeInTheDocument()
  })

  it('should show "No participants" message when list is empty', () => {
    render(
      <AdminPresenterSelect
        participants={[]}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    const button = screen.getByRole('button', { name: /Assign Presenter/i })
    fireEvent.click(button)

    expect(screen.getByText('No participants have joined yet')).toBeInTheDocument()
  })

  it('should not render when disabled', () => {
    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
        disabled={true}
      />
    )

    expect(screen.queryByRole('button', { name: /Assign Presenter/i })).not.toBeInTheDocument()
  })

  it('should show cancel button', () => {
    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    const button = screen.getByRole('button', { name: /Assign Presenter/i })
    fireEvent.click(button)

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
  })

  it('should close dropdown when cancel is clicked', () => {
    render(
      <AdminPresenterSelect
        participants={mockParticipants}
        segmentId={segmentId}
        onSelect={mockOnSelect}
      />
    )

    const button = screen.getByRole('button', { name: /Assign Presenter/i })
    fireEvent.click(button)

    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelButton)

    // Dropdown should close
    expect(screen.queryByText('Select new presenter:')).not.toBeInTheDocument()
  })
})
