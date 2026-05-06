export const DJANGO_API_BASE = "http://localhost:8001/api";

export function getAccessToken(): string | null {
  return localStorage.getItem("quasar_access_token");
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("quasar_access_token", access);
  localStorage.setItem("quasar_refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("quasar_access_token");
  localStorage.removeItem("quasar_refresh_token");
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem("quasar_refresh_token");
  if (!refresh) return null;
  try {
    const res = await fetch(`${DJANGO_API_BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const { access } = await res.json();
    localStorage.setItem("quasar_access_token", access);
    return access;
  } catch {
    return null;
  }
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const buildHeaders = (t: string | null) => {
    const headers = new Headers(options.headers || {});
    if (t) headers.set("Authorization", `Bearer ${t}`);
    if (
      !(options.body instanceof FormData) &&
      !headers.has("Content-Type") &&
      options.method &&
      options.method !== "GET"
    ) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  };

  let response = await fetch(url, { ...options, headers: buildHeaders(token) });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await fetch(url, { ...options, headers: buildHeaders(newToken) });
    } else {
      clearTokens();
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.includes("/login") &&
        !window.location.pathname.includes("/register")
      ) {
        window.location.href = "/login";
      }
    }
  }

  return response;
}
