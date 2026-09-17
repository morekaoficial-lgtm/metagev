export interface ApiError {
  status: number;
  message: string;
}

const TOKEN_KEY = 'gev_access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    setToken(data.accessToken);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

async function rawRequest<T>(path: string, options: RequestInit, retry = true): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers, credentials: 'include' });
  if (res.status === 401 && retry && path !== '/api/auth/refresh') {
    const newToken = await refreshAccessToken();
    if (newToken) return rawRequest<T>(path, options, false);
    setToken(null);
    window.location.href = '/login';
    throw { status: 401, message: 'Sesión expirada' } as ApiError;
  }
  if (!res.ok) {
    let message = 'Error';
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      message = `Error ${res.status}`;
    }
    throw { status: res.status, message } as ApiError;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => rawRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    rawRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    rawRequest<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    rawRequest<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => rawRequest<T>(path, { method: 'DELETE' }),
};

async function fetchBlob(path: string, retry = true): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { headers, credentials: 'include' });
  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return fetchBlob(path, false);
    setToken(null);
    window.location.href = '/login';
    throw { status: 401, message: 'Sesión expirada' } as ApiError;
  }
  if (!res.ok) {
    let message = 'Error';
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      message = `Error ${res.status}`;
    }
    throw { status: res.status, message } as ApiError;
  }
  return res.blob();
}

/**
 * Descarga un archivo protegido con JWT (CSV, PDF, etc.).
 * mode 'download' guarda el archivo; mode 'open' lo abre en una pestaña
 * nueva (útil para imprimir PDF desde el visor del navegador).
 */
export async function downloadFile(
  path: string,
  fallbackName: string,
  mode: 'download' | 'open' = 'download',
): Promise<void> {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  if (mode === 'open') {
    const win = window.open(url, '_blank');
    if (!win) {
      // Popup bloqueado: se descarga como respaldo.
      const a = document.createElement('a');
      a.href = url;
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    // Se revoca con retardo para que el visor del navegador cargue el blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
