import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectWebRTCSupport, getWebRTCErrorMessage, isMobileDevice } from '../webrtcDetection';

describe('webrtcDetection', () => {
  let originalUserAgent: string;
  let originalMediaDevices: MediaDevices | undefined;
  let originalInnerWidth: number;

  beforeEach(() => {
    vi.clearAllMocks();
    originalUserAgent = navigator.userAgent;
    originalMediaDevices = navigator.mediaDevices;
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    // Restore navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    // Restore navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
    });
    // Restore window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      configurable: true,
    });
  });

  const simulateMobileDevice = () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    });
  };

  const simulateDesktopDevice = () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      configurable: true,
    });
    Object.defineProperty(window, 'innerWidth', {
      value: 1920,
      configurable: true,
    });
  };

  describe('isMobileDevice', () => {
    it('should return true for iPhone user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should return true for Android user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 11; Pixel 5)',
        configurable: true,
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should return true for iPad user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        configurable: true,
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should return false for desktop user agent', () => {
      simulateDesktopDevice();
      expect(isMobileDevice()).toBe(false);
    });
  });

  describe('detectWebRTCSupport', () => {
    it('should return desktop_device for non-mobile devices', () => {
      simulateDesktopDevice();

      const result = detectWebRTCSupport();

      expect(result.isSupported).toBe(false);
      expect(result.canUseCamera).toBe(false);
      expect(result.reason).toBe('desktop_device');
    });

    it('should return supported when all checks pass on mobile', () => {
      simulateMobileDevice();
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn(),
        },
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        configurable: true,
      });

      const result = detectWebRTCSupport();

      expect(result.isSupported).toBe(true);
      expect(result.canUseCamera).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return no_media_devices when mediaDevices does not exist on mobile', () => {
      simulateMobileDevice();
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      });

      const result = detectWebRTCSupport();

      expect(result.isSupported).toBe(false);
      expect(result.canUseCamera).toBe(false);
      expect(result.reason).toBe('no_media_devices');
    });

    it('should return no_getusermedia when getUserMedia is not available on mobile', () => {
      simulateMobileDevice();
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        configurable: true,
      });

      const result = detectWebRTCSupport();

      expect(result.isSupported).toBe(false);
      expect(result.canUseCamera).toBe(false);
      expect(result.reason).toBe('no_getusermedia');
    });

    it('should return insecure_context when connection is not secure on mobile', () => {
      simulateMobileDevice();
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn(),
        },
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        configurable: true,
      });

      const result = detectWebRTCSupport();

      expect(result.isSupported).toBe(false);
      expect(result.canUseCamera).toBe(false);
      expect(result.reason).toBe('insecure_context');
    });
  });

  describe('getWebRTCErrorMessage', () => {
    it('should return desktop_device message', () => {
      const message = getWebRTCErrorMessage('desktop_device');
      expect(message).toContain('QR scanning works best on mobile devices');
    });

    it('should return no_media_devices message', () => {
      const message = getWebRTCErrorMessage('no_media_devices');
      expect(message).toContain('device does not have camera support');
    });

    it('should return no_getusermedia message', () => {
      const message = getWebRTCErrorMessage('no_getusermedia');
      expect(message).toContain('browser does not support camera access');
    });

    it('should return insecure_context message', () => {
      const message = getWebRTCErrorMessage('insecure_context');
      expect(message).toContain('secure connection');
    });

    it('should return generic message when reason is undefined', () => {
      const message = getWebRTCErrorMessage();
      expect(message).toContain('Camera access is not supported');
    });
  });
});
