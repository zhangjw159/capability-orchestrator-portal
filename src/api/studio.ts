import { request } from '@/base/api/request';
import type {
  StudioAssistant,
  StudioAssistantCreatePayload,
  StudioRunWaitRequest,
  StudioRunWaitResponse,
  StudioThread,
  StudioThreadCreatePayload,
} from '@/types/studio';

const PREFIX = '/api/v1/studio';

type ResultEnvelope<T> = {
  data?: T;
  result?: T;
};

function unwrapResult<T>(res: T | ResultEnvelope<T>): T {
  if (!res || typeof res !== 'object') return res as T;
  const envelope = res as ResultEnvelope<T>;
  if ('data' in envelope || 'result' in envelope) {
    return (envelope.data ?? envelope.result ?? (res as T)) as T;
  }
  return res as T;
}

function pickArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (!raw || typeof raw !== 'object') return [];
  const record = raw as Record<string, unknown>;
  for (const key of ['items', 'list', 'data', 'assistants', 'threads']) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }
  return [];
}

export function getStudioInfo() {
  return request
    .get<Record<string, unknown>>(`${PREFIX}/info`)
    .then((raw) => unwrapResult(raw));
}

export function searchAssistants(payload: Record<string, unknown>) {
  return request
    .post<Record<string, unknown>>(`${PREFIX}/assistants/search`, payload)
    .then((raw) => {
      const res = unwrapResult(raw);
      return pickArray<StudioAssistant>(res);
    });
}

export function createAssistant(payload: StudioAssistantCreatePayload) {
  return request
    .post<Record<string, unknown>>(`${PREFIX}/assistants`, payload)
    .then((raw) => unwrapResult(raw));
}

export async function createAssistantDirectLanggraph(
  payload: StudioAssistantCreatePayload,
  config: {
    baseUrl: string;
    path?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  }
) {
  const base = String(config.baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  const path = String(config.path ?? '/assistants').trim() || '/assistants';
  const normalizePath = (raw: string) => (raw.startsWith('/') ? raw : `/${raw}`);
  const candidatePaths = Array.from(
    new Set([path, '/assistants'].map(normalizePath))
  );
  const timeoutMs = config.timeoutMs ?? 60_000;
  if (!base) {
    throw new Error('LangGraph base_url 不能为空');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let lastError: unknown = null;
    for (const candidatePath of candidatePaths) {
      const response = await fetch(`${base}${candidatePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers ?? {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await response.text();
      let data: unknown = {};
      try {
        data = text ? (JSON.parse(text) as unknown) : {};
      } catch {
        data = { raw: text };
      }
      if (response.ok) {
        return data as Record<string, unknown>;
      }
      lastError = {
        status: response.status,
        data,
        requestPath: candidatePath,
      };
      // 仅对 404 做路径回退尝试，其它错误直接返回
      if (response.status !== 404) {
        throw lastError;
      }
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error('创建 assistant 失败：未知错误');
  } finally {
    clearTimeout(timer);
  }
}

export function runWait(payload: StudioRunWaitRequest) {
  return request
    .post<StudioRunWaitResponse>(`${PREFIX}/runs/wait`, payload)
    .then((raw) => unwrapResult(raw));
}

export async function runWaitDirectLanggraph(
  payload: StudioRunWaitRequest,
  config: {
    baseUrl: string;
    path?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  }
) {
  return postDirectLanggraph<StudioRunWaitResponse>(
    payload,
    config,
    '/runs/wait'
  );
}

async function postDirectLanggraph<T>(
  payload: Record<string, unknown>,
  config: {
    baseUrl: string;
    path?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  },
  defaultPath: string
) {
  const base = String(config.baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  const path = String(config.path ?? defaultPath).trim() || defaultPath;
  const timeoutMs = config.timeoutMs ?? 60_000;
  if (!base) {
    throw new Error('LangGraph base_url 不能为空');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${base}${path.startsWith('/') ? path : `/${path}`}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers ?? {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? (JSON.parse(text) as unknown) : {};
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      throw {
        status: response.status,
        data,
      };
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export function createThread(payload: StudioThreadCreatePayload) {
  return request
    .post<StudioThread>(`${PREFIX}/threads`, payload)
    .then((raw) => unwrapResult(raw));
}

export function copyThread(threadId: string) {
  return request
    .post<StudioThread>(`${PREFIX}/threads/${threadId}/copy`, {})
    .then((raw) => unwrapResult(raw));
}

export function runWaitOnThread(
  threadId: string,
  payload: StudioRunWaitRequest
) {
  return request
    .post<StudioRunWaitResponse>(
      `${PREFIX}/threads/${threadId}/runs/wait`,
      payload
    )
    .then((raw) => unwrapResult(raw));
}

export function getThreadState(
  threadId: string,
  params?: { subgraphs?: boolean }
) {
  return request
    .get<Record<string, unknown>>(
      `${PREFIX}/threads/${threadId}/state`,
      params ?? {}
    )
    .then((raw) => unwrapResult(raw));
}

export function updateThreadState(
  threadId: string,
  payload: {
    values?: Record<string, unknown> | unknown[];
    checkpoint?: Record<string, unknown>;
    as_node?: string;
    [key: string]: unknown;
  }
) {
  return request
    .post<Record<string, unknown>>(
      `${PREFIX}/threads/${threadId}/state`,
      payload
    )
    .then((raw) => unwrapResult(raw));
}

export async function createThreadDirectLanggraph(
  payload: StudioThreadCreatePayload,
  config: {
    baseUrl: string;
    path?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  }
) {
  return postDirectLanggraph<StudioThread>(payload, config, '/threads');
}

export async function copyThreadDirectLanggraph(
  threadId: string,
  config: {
    baseUrl: string;
    path?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  }
) {
  const path = config.path ?? `/threads/${encodeURIComponent(threadId)}/copy`;
  return postDirectLanggraph<StudioThread>({}, { ...config, path }, path);
}

export async function runWaitOnThreadDirectLanggraph(
  threadId: string,
  payload: StudioRunWaitRequest,
  config: {
    baseUrl: string;
    path?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  }
) {
  const path =
    config.path ?? `/threads/${encodeURIComponent(threadId)}/runs/wait`;
  return postDirectLanggraph<StudioRunWaitResponse>(
    payload,
    { ...config, path },
    path
  );
}

export async function getThreadStateDirectLanggraph(
  threadId: string,
  config: {
    baseUrl: string;
    path?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
    subgraphs?: boolean;
  }
) {
  const base = String(config.baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  const path = config.path ?? `/threads/${encodeURIComponent(threadId)}/state`;
  const timeoutMs = config.timeoutMs ?? 60_000;
  if (!base) throw new Error('LangGraph base_url 不能为空');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
    if (typeof config.subgraphs === 'boolean') {
      url.searchParams.set('subgraphs', String(config.subgraphs));
    }
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...(config.headers ?? {}),
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? (JSON.parse(text) as unknown) : {};
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      throw {
        status: response.status,
        data,
      };
    }
    return data as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

export async function updateThreadStateDirectLanggraph(
  threadId: string,
  payload: Record<string, unknown>,
  config: {
    baseUrl: string;
    path?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  }
) {
  const path = config.path ?? `/threads/${encodeURIComponent(threadId)}/state`;
  return postDirectLanggraph<Record<string, unknown>>(
    payload,
    { ...config, path },
    path
  );
}

export function searchThreads(payload: Record<string, unknown>) {
  return request
    .post<Record<string, unknown>>(`${PREFIX}/threads/search`, payload)
    .then((raw) => {
      const res = unwrapResult(raw);
      return pickArray<StudioThread>(res);
    });
}
