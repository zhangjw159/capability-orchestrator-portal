import { request } from '@/base/api/request';
import type { RegisteredTool } from '@/types/orchestrator';

const PREFIX = '/api/v1/orchestrator';

type ToolsListResponse = {
  list?: RegisteredTool[];
  items?: RegisteredTool[];
  tools?: RegisteredTool[];
  data?: RegisteredTool[];
};

export function listTools() {
  return request.get<ToolsListResponse | RegisteredTool[]>(`${PREFIX}/tools`);
}

export function refreshTools(body?: Record<string, unknown>) {
  return request.post<unknown>(`${PREFIX}/tools/refresh`, body ?? {});
}
