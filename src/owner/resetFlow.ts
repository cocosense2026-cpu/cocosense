const KEY = 'cocosense_owner_reset_flow';

export interface ResetFlowState {
  email: string;
  verified: boolean;
  requestedAt: number;
  code?: string;
}

export function getResetFlow(): ResetFlowState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ResetFlowState) : null;
  } catch {
    return null;
  }
}

export function setResetFlow(state: ResetFlowState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearResetFlow() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
