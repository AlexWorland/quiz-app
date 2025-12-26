import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { EventHostPage } from '../EventHost'

// Mock all endpoint functions before importing
vi.mock('@/api/endpoints', () => ({
  eventAPI: {
    get: vi.fn(),
    getSegment: vi.fn(),
    startRecording: vi.fn(),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    stopRecording: vi.fn(),
    restartRecording: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
  },
  getSegmentQuestions: vi.fn(),
  getSegmentLeaderboard: vi.fn(),
  getMasterLeaderboard: vi.fn(),
  getSegment: vi.fn(),
  resumeSegment: vi.fn(),
  clearSegmentResumeState: vi.fn(),
  resumeEvent: vi.fn(),
  clearEventResumeState: vi.fn(),
  exportEventResults: vi.fn(),
  downloadExport: vi.fn(),
}))

import * as endpoints from '@/api/endpoints'

// Mock modules
vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => ({
      user: { id: 'user-1', username: 'testuser' },
    })),
    {
      getState: vi.fn(() => ({
        token: 'test-token',
        user: { id: 'user-1', username: 'testuser' },
        logout: vi.fn(),
      })),
    }
  ),
}))

vi.mock('@/hooks/useEventWebSocket', () => ({
  useEventWebSocket: vi.fn(() => ({
    isConnected: true,
    sendMessage: vi.fn(),
  })),
}))

vi.mock('@/hooks/useAudioWebSocket', () => ({
  useAudioWebSocket: vi.fn(() => ({
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    audioCapabilities: null,
    audioError: null,
  })),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ eventId: 'event-1', segmentId: 'segment-1' }),
    useNavigate: () => vi.fn(),
  }
})

// Mock child components to avoid deep rendering
vi.mock('@/components/quiz/PresenterControls', () => ({
  PresenterControls: () => <div data-testid="presenter-controls">Presenter Controls</div>,
}))

vi.mock('@/components/quiz/PassPresenterButton', () => ({
  PassPresenterButton: () => <div data-testid="pass-presenter">Pass Presenter</div>,
}))

vi.mock('@/components/quiz/AdminPresenterSelect', () => ({
  AdminPresenterSelect: () => <div data-testid="admin-presenter">Admin Presenter</div>,
}))

vi.mock('@/components/quiz/AnswerProgress', () => ({
  AnswerProgress: () => <div data-testid="answer-progress">Answer Progress</div>,
}))

vi.mock('@/components/quiz/SegmentCompleteView', () => ({
  SegmentCompleteView: () => <div data-testid="segment-complete">Segment Complete</div>,
}))

vi.mock('@/components/recording/RecordingControls', () => ({
  RecordingControls: () => <div data-testid="recording-controls">Recording Controls</div>,
}))

vi.mock('@/components/recording/RecordingStatus', () => ({
  RecordingStatus: () => <div data-testid="recording-status">Recording Status</div>,
}))

vi.mock('@/components/recording/TranscriptView', () => ({
  TranscriptView: () => <div data-testid="transcript-view">Transcript</div>,
}))

vi.mock('@/components/recording/AudioFormatNotice', () => ({
  AudioFormatNotice: () => <div data-testid="audio-format">Audio Format</div>,
}))

vi.mock('@/components/questions/GeneratedQuestionList', () => ({
  GeneratedQuestionList: () => <div data-testid="question-list">Question List</div>,
}))

vi.mock('@/components/questions/QuizReadyIndicator', () => ({
  QuizReadyIndicator: () => <div data-testid="quiz-ready">Quiz Ready</div>,
}))

vi.mock('@/components/questions/QuestionEditor', () => ({
  QuestionEditor: () => <div data-testid="question-editor">Question Editor</div>,
}))

vi.mock('@/components/questions/QuestionCreator', () => ({
  QuestionCreator: () => <div data-testid="question-creator">Question Creator</div>,
}))

vi.mock('@/components/questions/BulkQuestionImport', () => ({
  BulkQuestionImport: () => <div data-testid="bulk-import">Bulk Import</div>,
}))

vi.mock('@/components/leaderboard/MasterLeaderboard', () => ({
  MasterLeaderboard: () => <div data-testid="master-leaderboard">Master Leaderboard</div>,
}))

vi.mock('@/components/leaderboard/SegmentLeaderboard', () => ({
  SegmentLeaderboard: () => <div data-testid="segment-leaderboard">Segment Leaderboard</div>,
}))

vi.mock('@/components/display/DisplayModeContainer', () => ({
  DisplayModeContainer: () => <div data-testid="display-mode">Display Mode</div>,
}))

const mockEvent = {
  id: 'event-1',
  host_id: 'user-1',
  title: 'Test Event',
  join_code: 'TEST01',
  mode: 'listen_only' as const,
  status: 'active' as const,
  num_fake_answers: 3,
  time_per_question: 30,
  join_locked: false,
  previous_status: 'waiting',
  created_at: '2024-01-01T00:00:00Z',
}

const mockEventWithoutResume = {
  ...mockEvent,
  previous_status: null,
}

const mockSegment = {
  id: 'segment-1',
  event_id: 'event-1',
  presenter_name: 'Test Presenter',
  order_index: 0,
  status: 'completed' as const,
  previous_status: 'quizzing',
  created_at: '2024-01-01T00:00:00Z',
}

const mockSegmentWithoutResume = {
  ...mockSegment,
  previous_status: null,
}

describe('EventHost Resume Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set default mock implementations
    vi.mocked(endpoints.eventAPI.get).mockResolvedValue({ data: mockEventWithoutResume } as any)
    vi.mocked(endpoints.getSegment).mockResolvedValue({ data: mockSegmentWithoutResume } as any)
    vi.mocked(endpoints.getSegmentQuestions).mockResolvedValue({ data: [] } as any)
    vi.mocked(endpoints.getSegmentLeaderboard).mockResolvedValue({ data: [] } as any)
    vi.mocked(endpoints.getMasterLeaderboard).mockResolvedValue({ data: [] } as any)
  })

  const renderEventHost = () => {
    return render(
      <BrowserRouter>
        <EventHostPage />
      </BrowserRouter>
    )
  }

  it('should show event resume controls when event has previous_status', async () => {
    vi.mocked(endpoints.eventAPI.get).mockResolvedValue({ data: mockEvent } as any)

    renderEventHost()

    await waitFor(() => {
      expect(screen.getByText('Event Ended Accidentally?')).toBeInTheDocument()
    })
  })

  it('should not show event resume controls when event has no previous_status', async () => {
    // Uses default mocks from beforeEach (no previous_status)

    renderEventHost()

    await waitFor(() => {
      expect(screen.getByText('Quiz Controls')).toBeInTheDocument()
    })

    expect(screen.queryByText('Event Ended Accidentally?')).not.toBeInTheDocument()
  })

  it('should show segment resume controls when segment has previous_status', async () => {
    vi.mocked(endpoints.getSegment).mockResolvedValue({ data: mockSegment } as any)

    renderEventHost()

    await waitFor(() => {
      expect(screen.getByText('Segment Ended Accidentally?')).toBeInTheDocument()
    })
  })

  it('should call resumeEvent when event resume button clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(endpoints.eventAPI.get).mockResolvedValue({ data: mockEvent } as any)
    vi.mocked(endpoints.resumeEvent).mockResolvedValue({
      data: { ...mockEvent, previous_status: null, status: 'waiting' },
    } as any)

    renderEventHost()

    await waitFor(() => {
      expect(screen.getByText('Event Ended Accidentally?')).toBeInTheDocument()
    })

    const resumeButton = screen.getByRole('button', { name: /Resume/i })
    await user.click(resumeButton)

    await waitFor(() => {
      expect(endpoints.resumeEvent).toHaveBeenCalledWith('event-1')
    })
  })

  it('should call clearEventResumeState when event clear button clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(endpoints.eventAPI.get).mockResolvedValue({ data: mockEvent } as any)
    vi.mocked(endpoints.clearEventResumeState).mockResolvedValue({
      data: { ...mockEvent, previous_status: null },
    } as any)

    renderEventHost()

    await waitFor(() => {
      expect(screen.getByText('Event Ended Accidentally?')).toBeInTheDocument()
    })

    const clearButton = screen.getByRole('button', { name: /Clear & Continue/i })
    await user.click(clearButton)

    await waitFor(() => {
      expect(endpoints.clearEventResumeState).toHaveBeenCalledWith('event-1')
    })
  })

  it('should call resumeSegment when segment resume button clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(endpoints.getSegment).mockResolvedValue({ data: mockSegment } as any)
    vi.mocked(endpoints.resumeSegment).mockResolvedValue({
      data: { ...mockSegment, previous_status: null, status: 'quizzing' },
    } as any)

    renderEventHost()

    await waitFor(() => {
      expect(screen.getByText('Segment Ended Accidentally?')).toBeInTheDocument()
    })

    const resumeButton = screen.getByRole('button', { name: /Resume/i })
    await user.click(resumeButton)

    await waitFor(() => {
      expect(endpoints.resumeSegment).toHaveBeenCalledWith('segment-1')
    })
  })

  it('should update local state after successful resume', async () => {
    const user = userEvent.setup()
    const resumedEvent = { ...mockEvent, previous_status: null, status: 'waiting' as const }
    vi.mocked(endpoints.eventAPI.get).mockResolvedValue({ data: mockEvent } as any)
    vi.mocked(endpoints.resumeEvent).mockResolvedValue({ data: resumedEvent } as any)

    renderEventHost()

    await waitFor(() => {
      expect(screen.getByText('Event Ended Accidentally?')).toBeInTheDocument()
    })

    const resumeButton = screen.getByRole('button', { name: /Resume/i })
    await user.click(resumeButton)

    await waitFor(() => {
      expect(screen.queryByText('Event Ended Accidentally?')).not.toBeInTheDocument()
    })
  })

  it('should show both event and segment resume controls when both have previous_status', async () => {
    vi.mocked(endpoints.eventAPI.get).mockResolvedValue({ data: mockEvent } as any)
    vi.mocked(endpoints.getSegment).mockResolvedValue({ data: mockSegment } as any)

    renderEventHost()

    await waitFor(() => {
      expect(screen.getByText('Event Ended Accidentally?')).toBeInTheDocument()
      expect(screen.getByText('Segment Ended Accidentally?')).toBeInTheDocument()
    })
  })

  it('should handle resume API errors gracefully', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(endpoints.eventAPI.get).mockResolvedValue({ data: mockEvent } as any)
    vi.mocked(endpoints.resumeEvent).mockRejectedValue(new Error('Network error'))

    renderEventHost()

    await waitFor(() => {
      expect(screen.getByText('Event Ended Accidentally?')).toBeInTheDocument()
    })

    const resumeButton = screen.getByRole('button', { name: /Resume/i })
    await user.click(resumeButton)

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to resume event:', expect.any(Error))
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    consoleError.mockRestore()
  })
})
