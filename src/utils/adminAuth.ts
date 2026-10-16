export const ADMIN_STORAGE_KEY = 'CHESS_ADMIN_SESSION_V1';
export const DEFAULT_ADMIN_PIN = 'admin2026';

/** Read saved admin pin/token from localStorage */
export function getStoredAdminPin(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Check if current browser session is authenticated as admin */
export function checkIsAdmin(): boolean {
  const pin = getStoredAdminPin();
  if (!pin) return false;
  return verifyAdminPin(pin);
}

/** Save admin login session */
export function saveAdminSession(pin: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, pin.trim());
  } catch {
    // Ignore storage errors
  }
}

/** Clear admin login session (logout) */
export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/** Verify entered PIN */
export function verifyAdminPin(pin: string): boolean {
  const trimmed = pin.trim();
  const configuredPin = process.env.NEXT_PUBLIC_ADMIN_PIN;
  
  if (configuredPin && trimmed === configuredPin) {
    return true;
  }

  // Allowed default PINs for admin convenience
  return trimmed === DEFAULT_ADMIN_PIN || trimmed === '1234';
}
