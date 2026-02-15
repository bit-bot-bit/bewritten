const API_BASE = '/api';

async function request(path, init = {}) {
  const token = localStorage.getItem('mythos_token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(init.headers || {}),
    },
    ...init,
  });

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

export function apiGet(path) {
  return request(path, { method: 'GET' });
}

export function apiPost(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut(path, body) {
  return request(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete(path) {
  return request(path, { method: 'DELETE' });
}
