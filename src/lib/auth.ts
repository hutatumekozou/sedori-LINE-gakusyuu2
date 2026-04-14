const DEFAULT_APP_LOGIN_PASSWORD = "1618";

export const APP_SESSION_COOKIE_NAME = "mercari-study-session";
export const APP_SESSION_COOKIE_VALUE = "authenticated";

export function getAppLoginPassword() {
  return process.env.APP_LOGIN_PASSWORD?.trim() || DEFAULT_APP_LOGIN_PASSWORD;
}

export function isAuthenticatedSession(value: string | undefined) {
  return value === APP_SESSION_COOKIE_VALUE;
}

export function getSafeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/")) {
    return "/items";
  }

  if (value.startsWith("//") || value.startsWith("/login") || value.startsWith("/api/auth/")) {
    return "/items";
  }

  return value;
}
