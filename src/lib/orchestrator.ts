import type { Flow, RegisteredTool, ValidationIssue } from '@/types/orchestrator';

function parseJsonRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeNodeType(raw: unknown): Flow['nodes'][number]['type'] {
  const text = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '');
  const mapping: Record<string, Flow['nodes'][number]['type']> = {
    start: 'start',
    end: 'end',
    set: 'set',
    template: 'template',
    condition: 'condition',
    confirm: 'confirm',
    tool: 'tool',
    model: 'model',
    foreach: 'foreach',
  };
  return mapping[text] ?? 'set';
}

/** 出现在任一 foreach.config.steps 中的节点：主图上不允许有任何边（仅由 foreach 调度）。 */
export function collectForeachExclusiveNodeIds(flow: Flow): Set<string> {
  const out = new Set<string>();
  for (const node of flow.nodes ?? []) {
    if (node.type !== 'foreach') continue;
    const steps = node.config?.steps;
    if (!Array.isArray(steps)) continue;
    for (const s of steps) {
      if (typeof s === 'string' && s.trim()) out.add(s.trim());
    }
  }
  return out;
}

export function validateForeachExclusiveEdges(flow: Flow): ValidationIssue[] {
  const exclusive = collectForeachExclusiveNodeIds(flow);
  if (exclusive.size === 0) return [];
  const issues: ValidationIssue[] = [];
  for (const edge of flow.edges ?? []) {
    const raw = edge as Record<string, unknown>;
    const from = String(raw.from ?? raw.source ?? '').trim();
    const to = String(raw.to ?? raw.target ?? '').trim();
    if (!from || !to) continue;
    if (exclusive.has(from) || exclusive.has(to)) {
      issues.push({
        code: 'foreach_body_edge',
        edgeId: typeof raw.id === 'string' ? raw.id : undefined,
        message: `边涉及 foreach 步骤节点（${from}→${to}）：步骤节点不应出现在 edges 中，请删除连线`,
      });
    }
  }
  return issues;
}

function normalizeFlowShape(raw: Record<string, unknown>): Flow {
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const edges = Array.isArray(raw.edges) ? raw.edges : [];
  const input =
    toRecord(raw.input_json).output != null
      ? toRecord(raw.input_json)
      : toRecord(raw.input).output != null
        ? toRecord(raw.input)
        : parseJsonRecord(raw.input_json).output != null
          ? parseJsonRecord(raw.input_json)
          : toRecord(raw.input);

  return {
    version: String(raw.version ?? 'flow/v1'),
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    input: Object.keys(input).length > 0 ? input : { output: {} },
    nodes: nodes
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const node = item as Record<string, unknown>;
        const config =
          Object.keys(toRecord(node.config)).length > 0
            ? toRecord(node.config)
            : parseJsonRecord(node.config_json);
        return {
          id: String(node.id ?? ''),
          type: normalizeNodeType(node.type ?? node.node_type),
          name: node.name != null ? String(node.name) : undefined,
          description: node.description != null ? String(node.description) : undefined,
          config,
        };
      }),
    edges: edges
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const edge = item as Record<string, unknown>;
        const from = String(edge.from ?? edge.source ?? '');
        const to = String(edge.to ?? edge.target ?? '');
        const next: Record<string, unknown> = {
          ...edge,
          id: String(edge.id ?? ''),
          from,
          to,
        };
        delete next.source;
        delete next.target;
        return next as Flow['edges'][number];
      }),
  };
}

export function parseFlowDsl(dsl: unknown): Flow | null {
  if (dsl == null) return null;
  if (typeof dsl === 'string') {
    try {
      const parsed = JSON.parse(dsl) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return normalizeFlowShape(parsed as Record<string, unknown>);
    } catch {
      return null;
    }
  }
  if (typeof dsl === 'object' && !Array.isArray(dsl)) {
    return normalizeFlowShape(dsl as Record<string, unknown>);
  }
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
