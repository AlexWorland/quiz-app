import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { vi } from 'vitest'
import { EventsPage } from '../Events'
import * as endpoints from '@/api/endpoints'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@/api/endpoints', () => {
  return {
    listEvents: vi.fn(),
    createEvent: vi.fn(),
    deleteEvent: vi.fn(),
  }
})

const mockListEvents = vi.mocked(endpoints.listEvents)
const mockCreateEvent = vi.mocked(endpoints.createEvent)

describe('EventsPage', () => {
  beforeEach(() => {
    mockListEvents.mockReset()
    mockCreateEvent.mockReset()
  })

  it('refetches events after creating a new event so the card appears', async () => {
    const initialEvents: endpoints.Event[] = []
    const newEvent: endpoints.Event = {
      id: 'event-1',
      host_id: 'host-1',
      title: 'New Event Title',
      description: 'Desc',
      join_code: 'ABC123',
      mode: 'normal',
      status: 'waiting',
      num_fake_answers: 3,
      time_per_question: 30,
      join_locked: false,
      created_at: new Date().toISOString(),
    }

    mockListEvents
      .mockResolvedValueOnce({ data: initialEvents }) // initial load
      .mockResolvedValueOnce({ data: [newEvent] }) // after create refetch
    mockCreateEvent.mockResolvedValueOnce({ data: newEvent })

    render(<EventsPage />)

    await waitFor(() => expect(mockListEvents).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /new event/i }))
    fireEvent.change(screen.getByLabelText(/event title/i), { target: { value: newEvent.title } })
    fireEvent.click(screen.getByRole('radio', { name: /traditional/i }))

    const modal = screen.getByText(/create new event/i).closest('div') as HTMLElement
    const createButton = within(modal).getByRole('button', { name: /create event/i })
    fireEvent.click(createButton)

    await waitFor(() => expect(mockCreateEvent).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockListEvents).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(newEvent.title)).toBeVisible()
  })
})

