import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Test setup file
 * 
 * IMPORTANT: When writing tests with fake timers, see TESTING_GUIDE.md
 * Key rules:
 * - Use fireEvent (not userEvent) with fake timers
 * - Wrap timer advances in act()
 * - Always clean up timers in afterEach
 */

afterEach(() => {
  cleanup();
});

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Set up MediaRecorder mock globally for all tests
class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = (mimeType: string) => {
    const supportedTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
    return supportedTypes.includes(mimeType);
  };

  stream: MediaStream;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onpause: ((event: Event) => void) | null = null;
  onresume: ((event: Event) => void) | null = null;

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.mimeType = options?.mimeType || 'audio/webm;codecs=opus';
    MockMediaRecorder.instances.push(this);
  }

  start(timeslice?: number) {
    this.state = 'recording';
    if (this.onstart) {
      this.onstart(new Event('start'));
    }

    if (timeslice && this.ondataavailable) {
      this.intervalId = setInterval(() => {
        if (this.ondataavailable && this.state === 'recording') {
          const blob = new Blob(['mock-audio-data'], { type: this.mimeType });
          this.ondataavailable({ data: blob } as BlobEvent);
        }
      }, timeslice);
    }
  }

  stop() {
    this.state = 'inactive';
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.onstop) {
      this.onstop(new Event('stop'));
    }
  }

  pause() {
    this.state = 'paused';
    if (this.onpause) {
      this.onpause(new Event('pause'));
    }
  }

  resume() {
    this.state = 'recording';
    if (this.onresume) {
      this.onresume(new Event('resume'));
    }
  }

  requestData() {
    if (this.ondataavailable) {
      const blob = new Blob(['mock-audio-data'], { type: this.mimeType });
      this.ondataavailable({ data: blob } as BlobEvent);
    }
  }

  static resetAll() {
    MockMediaRecorder.instances = [];
  }
}

(global as any).MediaRecorder = MockMediaRecorder;

const mockGetUserMedia = vi.fn().mockResolvedValue({
  getTracks: () => [{
    stop: vi.fn(),
    kind: 'audio',
    enabled: true,
  }],
  getAudioTracks: () => [{
    stop: vi.fn(),
    kind: 'audio',
    enabled: true,
  }],
});

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
  configurable: true,
});
