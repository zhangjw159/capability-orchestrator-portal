import type { Flow, RegisteredTool } from '@/types/orchestrator';

export function parseFlowDsl(dsl: unknown): Flow | null {
  if (dsl == null) return null;
  if (typeof dsl === 'string') {
    try {
      return JSON.parse(dsl) as Flow;
    } catch {
      return null;
    }
  }
  if (typeof dsl === 'object') return dsl as Flow;
  return null;
}

export function normalizeSkillFieldInFlow(flow: Flow): Flow {
  return {
    ...flow,
    nodes: (flow.nodes ?? []).map((node) => {
      if (node.type !== 'tool') return node;
      const config =
        node.config && typeof node.config === 'object' && !Array.isArray(node.config)
          ? ({ ...node.config } as Record<string, unknown>)
          : {};
      const mode = String(config.mode ?? 'skill');
      if (mode !== 'skill') return { ...node, config };
      const skillId = String(config.skillId ?? config.skill ?? '').trim();
      if (!skillId) return { ...node, config };
      return {
        ...node,
        config: {
          ...config,
          mode: 'skill',
          skillId,
          // backward compatible with old field name expected by some backends
          skill: skillId,
        },
      };
    }),
  };
}

export function normalizeList<T>(
  raw: unknown,
  keys = ['list', 'items', 'data']
): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    for (const k of keys) {
      const v = (raw as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

/**
 * 工具列表接口常以 `{ tools: [...] }` 返回，且可能与空的 `list`/`data` 并存。
 * 优先取 `tools`，并解析一层嵌套（如 `data.tools`）。
 */
export function extractToolsList(raw: unknown): RegisteredTool[] {
  if (Array.isArray(raw)) return raw as RegisteredTool[];
  if (!raw || typeof raw !== 'object') return [];

  const root = raw as Record<string, unknown>;

  if (Array.isArray(root.tools)) return root.tools as RegisteredTool[];

  for (const wrap of ['data', 'result'] as const) {
    const inner = root[wrap];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const t = (inner as Record<string, unknown>).tools;
      if (Array.isArray(t)) return t as RegisteredTool[];
    }
  }

  const preferOrder = ['tools', 'list', 'items', 'data'];
  for (const k of preferOrder) {
    const v = root[k];
    if (Array.isArray(v) && v.length > 0) return v as RegisteredTool[];
  }
  for (const k of preferOrder) {
    const v = root[k];
    if (Array.isArray(v)) return v as RegisteredTool[];
  }

  return [];
}

export function isValidationValid(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw > 0;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (!normalized) return false;
    if (
      ['true', 'ok', 'pass', 'passed', 'valid', '1', 'yes', 'y'].includes(
        normalized
      )
    ) {
      return true;
    }
    if (
      ['false', 'fail', 'failed', 'invalid', '0', 'no', 'n'].includes(
        normalized
      )
    ) {
      return false;
    }
  }
  return false;
}
