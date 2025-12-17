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

// Auth endpoints
export const authAPI = {
  register: (data: RegisterRequest) =>
    client.post<AuthResponse>('/auth/register', data),

  login: (data: LoginRequest) =>
    client.post<AuthResponse>('/auth/login', data),

  getMe: () =>
    client.get<User>('/auth/me'),

  updateProfile: (data: Partial<User>) =>
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
  created_at: string
}

export interface Segment {
  id: string
  event_id: string
  presenter_name: string
  title?: string
  order_index: number
  status: 'pending' | 'recording' | 'recording_paused' | 'quiz_ready' | 'quizzing' | 'completed'
  recording_started_at?: string
  recording_ended_at?: string
  quiz_started_at?: string
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
}

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

// Question endpoints
export const getSegmentQuestions = (segmentId: string) =>
  client.get<Question[]>(`/segments/${segmentId}/questions`)

// Question management by ID
export const updateQuestion = (questionId: string, data: Partial<Question>) =>
  client.put<Question>(`/questions/${questionId}`, data)

export const deleteQuestion = (questionId: string) =>
  client.delete(`/questions/${questionId}`)

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

// Convenience object
export const eventAPI = {
  list: listEvents,
  create: createEvent,
  get: getEvent,
  update: updateEvent,
  delete: deleteEvent,
  getByJoinCode: getEventByJoinCode,
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
}
