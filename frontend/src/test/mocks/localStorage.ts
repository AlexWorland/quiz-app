export class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value.toString();
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

export function setupLocalStorageMock() {
  const mockStorage = new MockLocalStorage();

  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
  });

  return mockStorage;
}

export function getLocalStorageData() {
  return (window.localStorage as MockLocalStorage);
}
