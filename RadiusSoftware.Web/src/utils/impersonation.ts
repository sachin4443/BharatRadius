/**
 * "Login as child site" support.
 *
 * Every time an admin opens a child site, the admin's own session (token + user)
 * is pushed on a stack. "Back to Admin" pops exactly one level, so
 * L1 → L2 → L3 → back → L2 → back → L1 works. A stored session is only restored
 * if its token is still valid; otherwise the user must log in again.
 */
const STACK_KEY = "adminSessionStack";

export interface StoredSession {
  token: string;
  user: string; // JSON of the user object
}

const readStack = (): StoredSession[] => {
  try {
    const raw = localStorage.getItem(STACK_KEY);
    const stack: StoredSession[] = raw ? JSON.parse(raw) : [];

    // Older versions stored a single session in adminToken / adminUser
    const legacyToken = localStorage.getItem("adminToken");
    const legacyUser = localStorage.getItem("adminUser");
    if (legacyToken && legacyUser && stack.length === 0) {
      stack.push({ token: legacyToken, user: legacyUser });
      localStorage.setItem(STACK_KEY, JSON.stringify(stack));
    }
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");

    return Array.isArray(stack) ? stack.filter((s) => s && s.token && s.user) : [];
  } catch {
    return [];
  }
};

const writeStack = (stack: StoredSession[]) => {
  if (stack.length === 0) localStorage.removeItem(STACK_KEY);
  else localStorage.setItem(STACK_KEY, JSON.stringify(stack));
};

/** true while the JWT is not expired (1 minute margin). */
export const isTokenValid = (token?: string | null): boolean => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
};

/** The session "Back to Admin" would return to (null when not impersonating). */
export const peekAdminSession = (): { session: StoredSession; user: any } | null => {
  const stack = readStack();
  const top = stack[stack.length - 1];
  if (!top) return null;
  try {
    return { session: top, user: JSON.parse(top.user) };
  } catch {
    return null;
  }
};

export const impersonationDepth = (): number => readStack().length;

/** Save the current session before switching into a child site. */
export const pushCurrentSession = () => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  if (!token || !user) return;
  const stack = readStack();
  stack.push({ token, user });
  writeStack(stack.slice(-10));
};

/** Undo pushCurrentSession when opening the child site failed. */
export const discardLastSession = () => {
  const stack = readStack();
  stack.pop();
  writeStack(stack);
};

/**
 * Go back one level. Returns false when the stored admin session has expired
 * (the caller then sends the user to the login page).
 */
export const popAdminSession = (): boolean => {
  const stack = readStack();
  const top = stack.pop();
  writeStack(stack);
  if (!top || !isTokenValid(top.token)) {
    writeStack([]);
    return false;
  }
  localStorage.setItem("token", top.token);
  localStorage.setItem("user", top.user);
  return true;
};
