export type WebRTCUnsupportedReason =
  | 'no_media_devices'
  | 'no_getusermedia'
  | 'insecure_context'
  | 'desktop_device';

export interface WebRTCDetectionResult {
  isSupported: boolean;
  canUseCamera: boolean;
  reason?: WebRTCUnsupportedReason;
}

/**
 * Detects if the current device is likely a mobile device.
 * Uses userAgent detection combined with touch capability check.
 */
export function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent || navigator.vendor || '';

  // Check for common mobile user agent patterns
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  if (mobileRegex.test(userAgent)) {
    return true;
  }

  // Check for touch capability as backup (tablets, etc.)
  // Note: Some laptops have touchscreens, so we only use this as secondary check
  if ('ontouchstart' in window && navigator.maxTouchPoints > 0) {
    // Additional check: mobile devices typically have smaller screens
    // This helps exclude touch-enabled laptops
    const isSmallScreen = window.innerWidth <= 1024;
    return isSmallScreen;
  }

  return false;
}

export function detectWebRTCSupport(): WebRTCDetectionResult {
  // On desktop devices, skip camera checks entirely - QR scanning is primarily for mobile
  if (!isMobileDevice()) {
    return {
      isSupported: false,
      canUseCamera: false,
      reason: 'desktop_device',
    };
  }

  // Check if mediaDevices exists
  if (!navigator.mediaDevices) {
    return {
      isSupported: false,
      canUseCamera: false,
      reason: 'no_media_devices',
    };
  }

  // Check if getUserMedia is available
  if (!navigator.mediaDevices.getUserMedia) {
    return {
      isSupported: false,
      canUseCamera: false,
      reason: 'no_getusermedia',
    };
  }

  // Check if context is secure (HTTPS or localhost)
  const isSecure = window.isSecureContext;
  if (!isSecure) {
    return {
      isSupported: false,
      canUseCamera: false,
      reason: 'insecure_context',
    };
  }

  return {
    isSupported: true,
    canUseCamera: true,
  };
}

export function getWebRTCErrorMessage(reason?: WebRTCUnsupportedReason): string {
  switch (reason) {
    case 'desktop_device':
      return 'QR scanning works best on mobile devices. Please enter the code manually below.';
    case 'no_media_devices':
      return 'Your device does not have camera support. Please use a device with a camera or enter the code manually.';
    case 'no_getusermedia':
      return 'Your browser does not support camera access. Please upgrade to a modern browser like Chrome, Firefox, or Safari.';
    case 'insecure_context':
      return 'Camera access requires a secure connection (HTTPS). Please use HTTPS or localhost.';
    default:
      return 'Camera access is not supported. Please enter the code manually.';
  }
}
