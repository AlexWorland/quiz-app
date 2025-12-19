import { http, HttpResponse } from 'msw';

const API_BASE_URL = 'http://localhost:8080/api';

export const handlers = [
  http.post(`${API_BASE_URL}/auth/register`, async () => {
    return HttpResponse.json({
      user: { id: 1, username: 'testuser', displayName: 'Test User' },
      token: 'mock-jwt-token',
    });
  }),

  http.post(`${API_BASE_URL}/auth/login`, async () => {
    return HttpResponse.json({
      user: { id: 1, username: 'testuser', displayName: 'Test User' },
      token: 'mock-jwt-token',
    });
  }),

  http.get(`${API_BASE_URL}/auth/me`, async () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      displayName: 'Test User',
    });
  }),

  http.get(`${API_BASE_URL}/events`, async () => {
    return HttpResponse.json([
      { id: 1, title: 'Test Event', code: 'TEST123', createdAt: new Date().toISOString() },
    ]);
  }),

  http.post(`${API_BASE_URL}/events`, async () => {
    return HttpResponse.json({
      id: 1,
      title: 'New Event',
      code: 'NEW123',
      createdAt: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE_URL}/events/:id`, async ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      title: 'Test Event',
      code: 'TEST123',
      createdAt: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE_URL}/leaderboard/:eventId`, async () => {
    return HttpResponse.json([
      { username: 'user1', score: 100, rank: 1 },
      { username: 'user2', score: 90, rank: 2 },
    ]);
  }),
];

export const errorHandlers = {
  unauthorized: http.get(`${API_BASE_URL}/auth/me`, async () => {
    return new HttpResponse(null, { status: 401 });
  }),

  serverError: http.get(`${API_BASE_URL}/events`, async () => {
    return new HttpResponse(null, { status: 500 });
  }),

  networkError: http.get(`${API_BASE_URL}/events`, async () => {
    return HttpResponse.error();
  }),
};
