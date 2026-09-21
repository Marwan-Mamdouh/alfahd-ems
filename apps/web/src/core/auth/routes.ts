/** Client-side login page route (not the API endpoint — see ENDPOINTS.auth.login) */
export const LOGIN_PATH = "/auth/login" as const;

/** Client-side dashboard root route */
export const DASHBOARD_PATH = "/dashboard" as const;

/** Name of the session-flag cookie set by auth.store and read by the proxy guard */
export const SESSION_COOKIE_NAME = "fahd-session" as const;
