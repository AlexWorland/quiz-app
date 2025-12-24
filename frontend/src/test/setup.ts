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

// Global mock for lucide-react icons
// Creates mock components with data-testid for testing
vi.mock('lucide-react', () => {
  const createMockIcon = (name: string) => {
    const IconComponent = (props: any) => {
      const { createElement } = require('react');
      const testId = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') + '-icon';
      return createElement('div', { 'data-testid': testId, ...props }, name);
    };
    IconComponent.displayName = name;
    return IconComponent;
  };

  // All lucide-react icons used in the application
  return {
    AlertCircle: createMockIcon('AlertCircle'),
    AlertTriangle: createMockIcon('AlertTriangle'),
    ArrowLeft: createMockIcon('ArrowLeft'),
    ArrowRight: createMockIcon('ArrowRight'),
    Award: createMockIcon('Award'),
    Book: createMockIcon('Book'),
    Camera: createMockIcon('Camera'),
    Check: createMockIcon('Check'),
    CheckCircle: createMockIcon('CheckCircle'),
    CheckCircle2: createMockIcon('CheckCircle2'),
    ChevronDown: createMockIcon('ChevronDown'),
    ChevronLeft: createMockIcon('ChevronLeft'),
    ChevronRight: createMockIcon('ChevronRight'),
    Circle: createMockIcon('Circle'),
    Clock: createMockIcon('Clock'),
    Copy: createMockIcon('Copy'),
    Crown: createMockIcon('Crown'),
    Download: createMockIcon('Download'),
    Edit: createMockIcon('Edit'),
    Edit2: createMockIcon('Edit2'),
    ExternalLink: createMockIcon('ExternalLink'),
    Eye: createMockIcon('Eye'),
    EyeOff: createMockIcon('EyeOff'),
    FileText: createMockIcon('FileText'),
    Grip: createMockIcon('Grip'),
    Hand: createMockIcon('Hand'),
    Info: createMockIcon('Info'),
    Loader: createMockIcon('Loader'),
    Loader2: createMockIcon('Loader2'),
    Lock: createMockIcon('Lock'),
    LogIn: createMockIcon('LogIn'),
    LogOut: createMockIcon('LogOut'),
    Medal: createMockIcon('Medal'),
    Menu: createMockIcon('Menu'),
    Mic: createMockIcon('Mic'),
    MicOff: createMockIcon('MicOff'),
    Minus: createMockIcon('Minus'),
    Moon: createMockIcon('Moon'),
    Pause: createMockIcon('Pause'),
    Pencil: createMockIcon('Pencil'),
    Play: createMockIcon('Play'),
    Plus: createMockIcon('Plus'),
    QrCode: createMockIcon('QrCode'),
    Radio: createMockIcon('Radio'),
    RefreshCw: createMockIcon('RefreshCw'),
    RotateCcw: createMockIcon('RotateCcw'),
    RotateCw: createMockIcon('RotateCw'),
    Save: createMockIcon('Save'),
    Search: createMockIcon('Search'),
    Send: createMockIcon('Send'),
    Settings: createMockIcon('Settings'),
    SkipForward: createMockIcon('SkipForward'),
    Smartphone: createMockIcon('Smartphone'),
    Square: createMockIcon('Square'),
    Star: createMockIcon('Star'),
    Sun: createMockIcon('Sun'),
    Trash2: createMockIcon('Trash2'),
    TrendingDown: createMockIcon('TrendingDown'),
    TrendingUp: createMockIcon('TrendingUp'),
    Trophy: createMockIcon('Trophy'),
    Unlock: createMockIcon('Unlock'),
    Upload: createMockIcon('Upload'),
    User: createMockIcon('User'),
    UserCog: createMockIcon('UserCog'),
    Users: createMockIcon('Users'),
    Volume2: createMockIcon('Volume2'),
    Wifi: createMockIcon('Wifi'),
    WifiOff: createMockIcon('WifiOff'),
    X: createMockIcon('X'),
    XCircle: createMockIcon('XCircle'),
    Zap: createMockIcon('Zap'),
  };
});
