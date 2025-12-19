export class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code, reason }));
      }
    }, 0);
  }

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  // Helper for tests to directly trigger onopen with proper state
  triggerOpen() {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      const messageData = typeof data === 'string' ? data : JSON.stringify(data);
      this.onmessage(new MessageEvent('message', { data: messageData }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateClose(code = 1000, reason = 'Normal closure') {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  static resetAll() {
    MockWebSocket.instances = [];
  }

  static getLatest(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

export function setupWebSocketMock() {
  (global as any).WebSocket = MockWebSocket;
}

export function cleanupWebSocketMock() {
  MockWebSocket.resetAll();
}
