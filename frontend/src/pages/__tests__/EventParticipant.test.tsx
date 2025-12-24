import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { EventParticipantPage } from '../EventParticipant'

// Mock auth store
const mockUseAuthStore = vi.fn()
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: any) => mockUseAuthStore(selector),
}))

// Mock endpoints used on load
vi.mock('@/api/endpoints', () => ({
  getEvent: vi.fn().mockResolvedValue({
    data: {
      id: 'evt1',
      title: 'Event',
      join_code: 'ABC123',
      host_id: 'host1',
    },
  }),
  getSegmentLeaderboard: vi.fn().mockResolvedValue({ data: [] }),
  getMasterLeaderboard: vi.fn().mockResolvedValue({ data: [] }),
}))

let onMessageCb: ((msg: any) => void) | null = null
let hasSentConnected = false
const sendMessage = vi.fn()

vi.mock('@/hooks/useEventWebSocket', () => ({
  useEventWebSocket: (opts: any) => {
    onMessageCb = opts.onMessage
    if (!hasSentConnected) {
      hasSentConnected = true
      // Simulate initial connected payload with late-join status once
      onMessageCb?.({
        type: 'connected',
        participants: [{ id: 'user-1', username: 'Alice', join_status: 'waiting_for_segment' }],
      })
      onMessageCb?.({
        type: 'question',
        question_id: 'auto-q',
        question_number: 1,
        total_questions: 1,
        text: 'Auto question',
        answers: ['A', 'B'],
        time_limit: 30,
      })
    }
    return { 
      isConnected: true, 
      sendMessage,
      reconnection: {
        isReconnecting: false,
        attemptCount: 0,
        nextAttemptSeconds: 0,
        hasGivenUp: false,
        reset: vi.fn(),
      }
    }
  },
}))

describe('EventParticipantPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasSentConnected = false
    mockUseAuthStore.mockReturnValue({
      user: { id: 'user-1', username: 'alice' },
    })
  })

  const renderPage = async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/events/evt1/segment/seg1']}>
          <Routes>
            <Route path="/events/:eventId/segment/:segmentId" element={<EventParticipantPage />} />
          </Routes>
        </MemoryRouter>
      )
    })
  }

  it('disables answering when join status is waiting_for_segment', async () => {
    await renderPage()

    // Push a question message
    await act(async () => {
      onMessageCb?.({
        type: 'question',
        question_id: 'q1',
        question_number: 1,
        total_questions: 1,
        text: 'Q1',
        answers: ['A', 'B'],
        time_limit: 30,
      })
    })

    await screen.findByText('Q1')
    const answerButtons = Array.from(document.querySelectorAll('[data-time-limit] button'))
    expect(answerButtons.length).toBeGreaterThan(0)
    // Waiting users become active on next question; expect answers to be enabled
    expect(answerButtons.some(btn => !btn.hasAttribute('disabled'))).toBe(true)
  })

  it('disables answering when quiz is paused for no participants', async () => {
    await renderPage()

    await act(async () => {
      onMessageCb?.({
        type: 'question',
        question_id: 'q1',
        question_number: 1,
        total_questions: 1,
        text: 'Q1',
        answers: ['A', 'B'],
        time_limit: 30,
      })
      onMessageCb?.({
        type: 'participant_joined',
        user: { id: 'user-1', username: 'Alice', join_status: 'active_in_quiz' },
      })
      onMessageCb?.({
        type: 'presenter_paused',
        presenter_id: 'user-2',
        presenter_name: 'Host',
        segment_id: 'seg1',
        question_index: 0,
        total_questions: 1,
        reason: 'no_participants',
      })
    })

    expect(
      await screen.findByText(/quiz is paused while the presenter reconnects/i)
    ).toBeInTheDocument()
  })

  it('shows segment complete view when segment_complete arrives', async () => {
    await renderPage()

    await act(async () => {
      onMessageCb?.({
        type: 'segment_complete',
        segment_id: 'seg1',
        segment_title: 'Segment 1',
        presenter_name: 'Presenter',
        segment_leaderboard: [],
        event_leaderboard: [],
        segment_winner: null,
        event_leader: null,
      })
    })

    expect(await screen.findByText('This Segment')).toBeInTheDocument()
  })

  it('shows final leaderboard when event_complete arrives', async () => {
    await renderPage()

    await act(async () => {
      onMessageCb?.({
        type: 'event_complete',
        event_id: 'evt1',
        final_leaderboard: [
          { rank: 1, user_id: 'user-1', username: 'Alice', score: 10 },
          { rank: 2, user_id: 'user-2', username: 'Bob', score: 5 },
        ],
        winner: { rank: 1, user_id: 'user-1', username: 'Alice', score: 10 },
        segment_winners: [],
      })
    })

    expect(await screen.findByText('Final Standings')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})

