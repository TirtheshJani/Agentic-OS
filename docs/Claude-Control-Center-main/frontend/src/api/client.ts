const BASE = '';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function buildHeaders(options?: RequestInit): Headers {
  const headers = new Headers(options?.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');

  const hasBody = options?.body != null;
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: buildHeaders(options),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new ApiError(res.status, text);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }

  return (await res.text()) as T;
}
