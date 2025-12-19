// Utility to get or create a unique device fingerprint
export function getOrCreateDeviceFingerprint(): string {
  const key = 'device_fingerprint';
  let fingerprint = localStorage.getItem(key);
  if (!fingerprint) {
    fingerprint = crypto.randomUUID();
    localStorage.setItem(key, fingerprint);
  }
  return fingerprint;
}