import type { ApiResponse } from '@/shared/api/banana/types';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export class BananaLectureApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'BananaLectureApiError';
    this.status = status;
    this.payload = payload;
  }
}

export interface BananaLectureRequestOptions extends Omit<RequestInit, 'body'> {
  query?: QueryParams;
  body?: BodyInit | object | null;
}

export interface BananaLectureApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

function buildUrl(baseUrl: string, path: string, query?: QueryParams) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = baseUrl.startsWith('http://') || baseUrl.startsWith('https://')
    ? new URL(`${baseUrl}${normalizedPath}`)
    : new URL(`${baseUrl}${normalizedPath}`, 'http://localhost');

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function normalizeBody(body: BananaLectureRequestOptions['body']) {
  if (body === undefined) return undefined;
  if (body === null) return null;
  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof ReadableStream
  ) {
    return body;
  }

  return JSON.stringify(body);
}

export function createBananaLectureRequester(options: BananaLectureApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? '/api/v1';
  const fetchImpl = options.fetch ?? fetch;

  async function request(path: string, init: BananaLectureRequestOptions = {}) {
    const { query, body, headers, ...rest } = init;
    const finalHeaders = new Headers(headers);
    const normalizedBody = normalizeBody(body);

    if (normalizedBody !== undefined && normalizedBody !== null && !(normalizedBody instanceof FormData) && !finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json');
    }

    return fetchImpl(buildUrl(baseUrl, path, query), {
      ...rest,
      headers: finalHeaders,
      body: normalizedBody,
    });
  }

  async function requestJson<T>(path: string, init: BananaLectureRequestOptions = {}) {
    const response = await request(path, init);
    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok) {
      throw new BananaLectureApiError(payload?.message || response.statusText || 'Request failed', response.status, payload);
    }

    if (!payload) {
      throw new BananaLectureApiError('Empty response payload', response.status);
    }

    return payload;
  }

  async function requestBlob(path: string, init: BananaLectureRequestOptions = {}) {
    const response = await request(path, init);
    if (!response.ok) {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = await response.text().catch(() => null);
      }
      throw new BananaLectureApiError(response.statusText || 'Request failed', response.status, payload);
    }
    return response.blob();
  }

  function buildFileUrl(path: string, query?: QueryParams) {
    return buildUrl(baseUrl, path, query).toString().replace('http://localhost', '');
  }

  return {
    request,
    requestJson,
    requestBlob,
    buildFileUrl,
  };
}
