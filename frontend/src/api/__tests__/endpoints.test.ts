import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  authAPI,
  uploadAPI,
  listEvents,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  getEventByJoinCode,
  createSegment,
  updateSegment,
  deleteSegment,
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  restartRecording,
  getSegmentQuestions,
  createQuestionForSegment,
  updateQuestion,
  deleteQuestion,
  bulkImportQuestions,
  getMasterLeaderboard,
  getSegmentLeaderboard,
  getSegment,
  getCanvasStrokes,
  clearCanvas,
  eventAPI,
} from '../endpoints';
import client from '../client';

// Mock the client
vi.mock('../client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedClient = vi.mocked(client);

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authAPI', () => {
    it('register should call client.post with correct parameters', () => {
      const data = {
        username: 'testuser',
        password: 'password123',
        avatar_url: 'https://example.com/avatar.png',
        avatar_type: 'custom' as const,
      };

      authAPI.register(data);

      expect(mockedClient.post).toHaveBeenCalledWith('/auth/register', data);
    });

    it('login should call client.post with correct parameters', () => {
      const data = {
        username: 'testuser',
        password: 'password123',
      };

      authAPI.login(data);

      expect(mockedClient.post).toHaveBeenCalledWith('/auth/login', data);
    });

    it('getMe should call client.get with correct endpoint', () => {
      authAPI.getMe();

      expect(mockedClient.get).toHaveBeenCalledWith('/auth/me');
    });

    it('updateProfile should call client.put with correct parameters', () => {
      const data = {
        username: 'newusername',
        avatar_url: 'https://example.com/new-avatar.png',
      };

      authAPI.updateProfile(data);

      expect(mockedClient.put).toHaveBeenCalledWith('/auth/profile', data);
    });
  });

  describe('uploadAPI', () => {
    it('uploadAvatar should call client.post with FormData', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', file);

      uploadAPI.uploadAvatar(file);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/upload/avatar',
        expect.any(FormData),
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Verify FormData contains the file
      const callArgs = mockedClient.post.mock.calls[0];
      const sentFormData = callArgs[1] as FormData;
      expect(sentFormData.get('file')).toBe(file);
    });
  });

  describe('Event endpoints', () => {
    it('listEvents should call client.get with correct endpoint', () => {
      listEvents();

      expect(mockedClient.get).toHaveBeenCalledWith('/quizzes');
    });

    it('createEvent should call client.post with correct parameters', () => {
      const data = {
        title: 'Test Event',
        description: 'Test Description',
        mode: 'listen_only' as const,
        num_fake_answers: 3,
        time_per_question: 30,
      };

      createEvent(data);

      expect(mockedClient.post).toHaveBeenCalledWith('/quizzes', data);
    });

    it('getEvent should call client.get with correct endpoint', () => {
      const eventId = 'event-123';

      getEvent(eventId);

      expect(mockedClient.get).toHaveBeenCalledWith('/quizzes/event-123');
    });

    it('updateEvent should call client.put with correct parameters', () => {
      const eventId = 'event-123';
      const data = {
        title: 'Updated Title',
        status: 'active' as const,
      };

      updateEvent(eventId, data);

      expect(mockedClient.put).toHaveBeenCalledWith('/quizzes/event-123', data);
    });

    it('deleteEvent should call client.delete with correct endpoint', () => {
      const eventId = 'event-123';

      deleteEvent(eventId);

      expect(mockedClient.delete).toHaveBeenCalledWith('/quizzes/event-123');
    });

    it('getEventByJoinCode should call client.get with correct endpoint', () => {
      const code = 'ABC123';

      getEventByJoinCode(code);

      expect(mockedClient.get).toHaveBeenCalledWith('/events/join/ABC123');
    });
  });

  describe('Segment endpoints', () => {
    it('createSegment should call client.post with correct parameters', () => {
      const eventId = 'event-123';
      const data = {
        presenter_name: 'John Doe',
        presenter_user_id: 'user-456',
        title: 'Segment 1',
      };

      createSegment(eventId, data);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/quizzes/event-123/questions',
        data
      );
    });

    it('updateSegment should call client.put with correct parameters', () => {
      const eventId = 'event-123';
      const segmentId = 'segment-456';
      const data = {
        title: 'Updated Segment',
        status: 'quiz_ready' as const,
      };

      updateSegment(eventId, segmentId, data);

      expect(mockedClient.put).toHaveBeenCalledWith(
        '/quizzes/event-123/questions/segment-456',
        data
      );
    });

    it('deleteSegment should call client.delete with correct endpoint', () => {
      const eventId = 'event-123';
      const segmentId = 'segment-456';

      deleteSegment(eventId, segmentId);

      expect(mockedClient.delete).toHaveBeenCalledWith(
        '/quizzes/event-123/questions/segment-456'
      );
    });

    it('getSegment should call client.get with correct endpoint', () => {
      const eventId = 'event-123';
      const segmentId = 'segment-456';

      getSegment(eventId, segmentId);

      expect(mockedClient.get).toHaveBeenCalledWith(
        '/events/event-123/segments/segment-456'
      );
    });
  });

  describe('Recording endpoints', () => {
    const segmentId = 'segment-123';

    it('startRecording should call client.post with correct endpoint', () => {
      startRecording(segmentId);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/segments/segment-123/recording/start'
      );
    });

    it('pauseRecording should call client.post with correct endpoint', () => {
      pauseRecording(segmentId);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/segments/segment-123/recording/pause'
      );
    });

    it('resumeRecording should call client.post with correct endpoint', () => {
      resumeRecording(segmentId);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/segments/segment-123/recording/resume'
      );
    });

    it('stopRecording should call client.post with correct endpoint', () => {
      stopRecording(segmentId);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/segments/segment-123/recording/stop'
      );
    });

    it('restartRecording should call client.post with correct endpoint', () => {
      restartRecording(segmentId);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/segments/segment-123/recording/restart'
      );
    });
  });

  describe('Question endpoints', () => {
    it('getSegmentQuestions should call client.get with correct endpoint', () => {
      const segmentId = 'segment-123';

      getSegmentQuestions(segmentId);

      expect(mockedClient.get).toHaveBeenCalledWith(
        '/segments/segment-123/questions'
      );
    });

    it('createQuestionForSegment should call client.post with correct parameters', () => {
      const segmentId = 'segment-123';
      const data = {
        question_text: 'What is 2+2?',
        correct_answer: '4',
        order_index: 1,
      };

      createQuestionForSegment(segmentId, data);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/segments/segment-123/questions',
        data
      );
    });

    it('updateQuestion should call client.put with correct parameters', () => {
      const questionId = 'question-123';
      const data = {
        question_text: 'Updated question',
        correct_answer: 'Updated answer',
      };

      updateQuestion(questionId, data);

      expect(mockedClient.put).toHaveBeenCalledWith(
        '/questions/question-123',
        data
      );
    });

    it('deleteQuestion should call client.delete with correct endpoint', () => {
      const questionId = 'question-123';

      deleteQuestion(questionId);

      expect(mockedClient.delete).toHaveBeenCalledWith('/questions/question-123');
    });

    it('bulkImportQuestions should call client.post with correct parameters', () => {
      const segmentId = 'segment-123';
      const data = {
        questions: [
          { question_text: 'Q1', correct_answer: 'A1' },
          { question_text: 'Q2', correct_answer: 'A2' },
        ],
      };

      bulkImportQuestions(segmentId, data);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/segments/segment-123/questions/bulk',
        data
      );
    });
  });

  describe('Leaderboard endpoints', () => {
    it('getMasterLeaderboard should call client.get with correct endpoint', () => {
      const eventId = 'event-123';

      getMasterLeaderboard(eventId);

      expect(mockedClient.get).toHaveBeenCalledWith(
        '/events/event-123/leaderboard'
      );
    });

    it('getSegmentLeaderboard should call client.get with correct endpoint', () => {
      const segmentId = 'segment-123';

      getSegmentLeaderboard(segmentId);

      expect(mockedClient.get).toHaveBeenCalledWith(
        '/segments/segment-123/leaderboard'
      );
    });
  });

  describe('Canvas endpoints', () => {
    it('getCanvasStrokes should call client.get with correct endpoint', () => {
      const eventId = 'event-123';

      getCanvasStrokes(eventId);

      expect(mockedClient.get).toHaveBeenCalledWith('/events/event-123/canvas');
    });

    it('clearCanvas should call client.delete with correct endpoint', () => {
      const eventId = 'event-123';

      clearCanvas(eventId);

      expect(mockedClient.delete).toHaveBeenCalledWith('/events/event-123/canvas');
    });
  });

  describe('eventAPI convenience object', () => {
    it('should have all expected methods', () => {
      expect(eventAPI.list).toBe(listEvents);
      expect(eventAPI.create).toBe(createEvent);
      expect(eventAPI.get).toBe(getEvent);
      expect(eventAPI.update).toBe(updateEvent);
      expect(eventAPI.delete).toBe(deleteEvent);
      expect(eventAPI.getByJoinCode).toBe(getEventByJoinCode);
      expect(eventAPI.createSegment).toBe(createSegment);
      expect(eventAPI.updateSegment).toBe(updateSegment);
      expect(eventAPI.deleteSegment).toBe(deleteSegment);
      expect(eventAPI.startRecording).toBe(startRecording);
      expect(eventAPI.pauseRecording).toBe(pauseRecording);
      expect(eventAPI.resumeRecording).toBe(resumeRecording);
      expect(eventAPI.stopRecording).toBe(stopRecording);
      expect(eventAPI.restartRecording).toBe(restartRecording);
      expect(eventAPI.getSegmentQuestions).toBe(getSegmentQuestions);
      expect(eventAPI.updateQuestion).toBe(updateQuestion);
      expect(eventAPI.deleteQuestion).toBe(deleteQuestion);
      expect(eventAPI.getMasterLeaderboard).toBe(getMasterLeaderboard);
      expect(eventAPI.getSegmentLeaderboard).toBe(getSegmentLeaderboard);
      expect(eventAPI.getSegment).toBe(getSegment);
      expect(eventAPI.getCanvasStrokes).toBe(getCanvasStrokes);
      expect(eventAPI.clearCanvas).toBe(clearCanvas);
    });

    it('should call underlying functions correctly', () => {
      const eventId = 'event-123';
      eventAPI.get(eventId);

      expect(mockedClient.get).toHaveBeenCalledWith('/quizzes/event-123');
    });
  });
});

