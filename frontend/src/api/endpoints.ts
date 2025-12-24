import client from './client'
import { User } from '@/store/authStore'

export interface RegisterRequest {
  username: string
  password: string
  avatar_url: string
  avatar_type: 'emoji' | 'preset' | 'custom'
}

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface UpdateProfileRequest {
  username?: string
  avatar_url?: string
  avatar_type?: 'emoji' | 'preset' | 'custom'
}

// Auth endpoints
export const authAPI = {
  register: (data: RegisterRequest) =>
    client.post<AuthResponse>('/auth/register', data),

  login: (data: LoginRequest) =>
    client.post<AuthResponse>('/auth/login', data),

  getMe: () =>
    client.get<User>('/auth/me'),

  updateProfile: (data: UpdateProfileRequest) =>
    client.put<User>('/auth/profile', data),
}

// Avatar upload
export const uploadAPI = {
  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post<{ url: string; file_name: string }>('/upload/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

export interface Event {
  id: string
  host_id: string
  title: string
  description?: string
  join_code: string
  mode: 'listen_only' | 'normal'
  status: 'waiting' | 'active' | 'finished'
  num_fake_answers: number
  time_per_question: number
  join_locked: boolean
  join_locked_at?: string
  previous_status?: string | null
  ended_at?: string | null
  created_at: string
}

export interface Segment {
  id: string
  event_id: string
  presenter_name: string
  presenter_user_id?: string
  title?: string
  order_index: number
  status: 'pending' | 'recording' | 'recording_paused' | 'quiz_ready' | 'quizzing' | 'completed'
  recording_started_at?: string
  recording_ended_at?: string
  quiz_started_at?: string
  previous_status?: string | null
  ended_at?: string | null
  created_at: string
}

export interface CreateEventRequest {
  title: string
  description?: string
  mode?: 'listen_only' | 'normal'
  num_fake_answers?: number
  time_per_question?: number
  question_gen_interval_seconds?: number // Interval for AI question generation (10-300 seconds, default: 30)
}

export interface CreateSegmentRequest {
  presenter_name: string
  presenter_user_id?: string
  title?: string
}

export interface Question {
  id: string
  segment_id: string
  question_text: string
  correct_answer: string
  order_index: number
  is_ai_generated?: boolean
  source_transcript?: string
  quality_score?: number
  generated_at?: string
  created_at?: string
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_url?: string
  score: number
  /** Whether this participant joined after the quiz started */
  is_late_joiner?: boolean
  response_time_ms?: number
  /** Whether this participant is currently connected to the event */
  is_present?: boolean
}

export type QuizPhase =
  | 'not_started'
  | 'showing_question'
  | 'revealing_answer'
  | 'showing_leaderboard'
  | 'between_questions'
  | 'segment_complete'
  | 'mega_quiz_ready'
  | 'mega_quiz'
  | 'event_complete'
  | 'presenter_paused'

// Event endpoints
export const listEvents = () =>
  client.get<Event[]>('/quizzes')

export const createEvent = (data: CreateEventRequest) =>
  client.post<Event>('/quizzes', data)

export const getEvent = (id: string) =>
  client.get<Event>(`/quizzes/${id}`)

export const updateEvent = (id: string, data: Partial<Event>) =>
  client.put<Event>(`/quizzes/${id}`, data)

export const deleteEvent = (id: string) =>
  client.delete(`/quizzes/${id}`)

// Event by join code
export const getEventByJoinCode = (code: string) =>
  client.get<Event>(`/events/join/${code}`)

// Join event with device fingerprint
export interface JoinEventRequest {
  code: string
  deviceFingerprint: string
  display_name: string
  avatar_url?: string
  avatar_type?: 'emoji' | 'preset' | 'custom'
}

export interface JoinEventResponse {
  eventId: string
  deviceId: string
  sessionToken: string
  displayName: string
  isRejoining: boolean
}

export const joinEvent = (request: JoinEventRequest) =>
  client.post<JoinEventResponse>('/events/join', request)

// Recover participant session after device identity loss
export interface RecoverParticipantRequest {
  display_name: string
  new_device_fingerprint: string
}

export const recoverParticipant = (eventId: string, request: RecoverParticipantRequest) =>
  client.post<JoinEventResponse>(`/events/${eventId}/recover-participant`, request)

// Join event as host (anonymous participation)
export interface JoinAsHostRequest {
  display_name: string
  avatar_url?: string
  avatar_type?: 'emoji' | 'preset' | 'custom'
}

export const joinAsHost = (eventId: string, request: JoinAsHostRequest) =>
  client.post<JoinEventResponse>(`/events/${eventId}/join-as-host`, request)

// Get event participants
export interface EventParticipant {
  id: string
  event_id: string
  display_name: string
  avatar_url?: string
  avatar_type?: string
  total_score: number
  join_status: string
  is_late_joiner: boolean
}

export const getEventParticipants = (eventId: string) =>
  client.get<EventParticipant[]>(`/events/${eventId}/participants`)

// Update participant display name
export const updateParticipantDisplayName = (
  eventId: string,
  participantId: string,
  displayName: string
) =>
  client.patch<EventParticipant>(
    `/events/${eventId}/participants/${participantId}/name`,
    { display_name: displayName }
  )

// QR Code for event join
export interface QrCodeResponse {
  qr_code: string  // SVG string
  join_url: string
  join_code: string
  participant_count: number
}

export const getEventQrCode = (eventId: string, size?: number) =>
  client.get<QrCodeResponse>(`/events/${eventId}/qr`, { params: { size } })

// Join lock/unlock endpoints
export interface JoinLockResponse {
  join_locked: boolean
  join_locked_at: string | null
  message: string
}

export const lockEventJoin = (eventId: string) =>
  client.post<JoinLockResponse>(`/events/${eventId}/join/lock`)

export const unlockEventJoin = (eventId: string) =>
  client.post<JoinLockResponse>(`/events/${eventId}/join/unlock`)

export const getJoinLockStatus = (eventId: string) =>
  client.get<JoinLockResponse>(`/events/${eventId}/join/status`)

export const createSegment = (eventId: string, data: CreateSegmentRequest) =>
  client.post<Segment>(`/quizzes/${eventId}/questions`, data)

export const updateSegment = (eventId: string, segmentId: string, data: Partial<Segment>) =>
  client.put<Segment>(`/quizzes/${eventId}/questions/${segmentId}`, data)

export const deleteSegment = (eventId: string, segmentId: string) =>
  client.delete(`/quizzes/${eventId}/questions/${segmentId}`)

// Segment recording endpoints
export const startRecording = (segmentId: string) =>
  client.post<Segment>(`/segments/${segmentId}/recording/start`)

export const pauseRecording = (segmentId: string) =>
  client.post<Segment>(`/segments/${segmentId}/recording/pause`)

export const resumeRecording = (segmentId: string) =>
  client.post<Segment>(`/segments/${segmentId}/recording/resume`)

export const stopRecording = (segmentId: string) =>
  client.post<Segment>(`/segments/${segmentId}/recording/stop`)

export const restartRecording = (segmentId: string) =>
  client.post<Segment>(`/segments/${segmentId}/recording/restart`)

// Segment completion and resume
export const completeSegment = (segmentId: string) =>
  client.post<Segment>(`/segments/${segmentId}/complete`)

export const resumeSegment = (segmentId: string) =>
  client.post<Segment>(`/segments/${segmentId}/resume`)

export const clearSegmentResumeState = (segmentId: string) =>
  client.post<Segment>(`/segments/${segmentId}/clear-resume`)

// Event completion and resume
export const completeEvent = (eventId: string) =>
  client.post<Event>(`/quizzes/${eventId}/complete`)

export const resumeEvent = (eventId: string) =>
  client.post<Event>(`/quizzes/${eventId}/resume`)

export const clearEventResumeState = (eventId: string) =>
  client.post<Event>(`/quizzes/${eventId}/clear-resume`)

// Question endpoints
export const getSegmentQuestions = (segmentId: string) =>
  client.get<Question[]>(`/segments/${segmentId}/questions`)

export interface CreateQuestionRequest {
  question_text: string
  correct_answer: string
  order_index?: number
}

export const createQuestionForSegment = (segmentId: string, data: CreateQuestionRequest) =>
  client.post<Question>(`/segments/${segmentId}/questions`, data)

// Question management by ID
export const updateQuestion = (questionId: string, data: Partial<Question>) =>
  client.put<Question>(`/questions/${questionId}`, data)

export const deleteQuestion = (questionId: string) =>
  client.delete(`/questions/${questionId}`)

// Bulk import questions
export interface BulkImportRequest {
  questions: Array<{
    question_text: string
    correct_answer: string
  }>
}

export interface BulkImportResponse {
  imported: number
  failed: number
}

export const bulkImportQuestions = (segmentId: string, data: BulkImportRequest) =>
  client.post<BulkImportResponse>(`/segments/${segmentId}/questions/bulk`, data)

// Leaderboard endpoints
export const getMasterLeaderboard = (eventId: string) =>
  client.get<LeaderboardEntry[]>(`/events/${eventId}/leaderboard`)

export const getSegmentLeaderboard = (segmentId: string) =>
  client.get<LeaderboardEntry[]>(`/segments/${segmentId}/leaderboard`)

export const getSegment = (eventId: string, segmentId: string) =>
  client.get<Segment>(`/events/${eventId}/segments/${segmentId}`)

// Canvas endpoints
export const getCanvasStrokes = (eventId: string) =>
  client.get(`/events/${eventId}/canvas`)

export const clearCanvas = (eventId: string) =>
  client.delete(`/events/${eventId}/canvas`)

// Export endpoints
export type ExportFormat = 'json' | 'csv'

export interface EventExport {
  event: {
    id: string
    title: string
    description?: string
    join_code: string
    mode: string
    status: string
    created_at: string
  }
  segments: Array<{
    id: string
    title?: string
    presenter_name: string
    status: string
    questions: Array<{
      id: string
      question_text: string
      correct_answer: string
      order_index: number
    }>
  }>
  participants: Array<{
    id: string
    display_name: string
    total_score: number
    is_late_joiner: boolean
    joined_at: string
  }>
  final_leaderboard: Array<{
    rank: number
    display_name: string
    score: number
    is_late_joiner: boolean
  }>
  exported_at: string
}

export const exportEventResults = async (eventId: string, format: ExportFormat = 'json') => {
  const response = await client.get(`/events/${eventId}/export`, {
    params: { format },
    responseType: 'blob',
  })
  return response
}

// Utility to trigger download from blob response
export const downloadExport = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Convenience object
export const eventAPI = {
  list: listEvents,
  create: createEvent,
  get: getEvent,
  update: updateEvent,
  delete: deleteEvent,
  getByJoinCode: getEventByJoinCode,
  joinAsHost,
  createSegment,
  updateSegment,
  deleteSegment,
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  restartRecording,
  getSegmentQuestions,
  updateQuestion,
  deleteQuestion,
  getMasterLeaderboard,
  getSegmentLeaderboard,
  getSegment,
  getCanvasStrokes,
  clearCanvas,
  exportResults: exportEventResults,
  downloadExport,
}
