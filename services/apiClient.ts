const API_BASE = '/api';

interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

async function request(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem('mythos_token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const url = `${API_BASE}${path}`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...(init.headers || {}),
      },
      ...init,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown network error');
    throw new Error(`${message} (${url}). Ensure backend is running and /api proxy routes to it.`);
  }

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}

export function apiGet(path: string) {
  return request(path, { method: 'GET' });
}

export function apiPost(path: string, body: any) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut(path: string, body: any) {
  return request(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete(path: string) {
  return request(path, { method: 'DELETE' });
}
