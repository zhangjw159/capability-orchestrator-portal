import { request } from '@/base/api/request';
import type {
  ExecutionDetail,
  ExecutionStep,
  ExecutionSummary,
  ExecuteFlowPayload,
  ExecuteFlowResult,
  Flow,
  FlowDefinitionDetail,
  FlowDefinitionSummary,
  ValidateFlowResult,
} from '@/types/orchestrator';

const PREFIX = '/api/v1/orchestrator';

type RawValidationIssue = {
  code?: string;
  edgeId?: string;
  nodeId?: string;
  message?: string;
};

type RawValidationResult = {
  valid?: boolean;
  errors?: RawValidationIssue[];
  warnings?: RawValidationIssue[];
};

type RawFlowNode = {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  config?: Record<string, unknown>;
};

type RawFlowEdge = {
  id?: string;
  from?: string;
  to?: string;
  label?: string;
  default?: boolean;
};

type RawFlow = {
  id?: string;
  name?: string;
  version?: string;
  input?: Record<string, unknown>;
  nodes?: RawFlowNode[];
  edges?: RawFlowEdge[];
};

type RawAssetFlowNode = {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  config_json?: string;
};

type RawAssetFlowEdge = {
  id?: string;
  from?: string;
  to?: string;
  label?: string;
  default?: boolean;
};

type RawAssetFlowDefinitionDsl = {
  id?: string;
  name?: string;
  version?: string;
  input_json?: string;
  nodes?: RawAssetFlowNode[];
  edges?: RawAssetFlowEdge[];
};

type RawFlowDefinitionItem = {
  id?: string;
  flow_id?: string;
  name?: string;
  description?: string;
  dsl?: string;
  status?: string;
  version?: number;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  published_at?: string;
};

type RawFlowDefinitionModel = {
  id?: string;
  flow_id?: string;
  name?: string;
  description?: string;
  dsl?: string;
  status?: string;
  version?: number;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  published_at?: string;
};

type RawListFlowDefinitionsResponse = {
  definitions?: RawFlowDefinitionItem[];
};

type RawGetFlowDefinitionResponse = {
  definition?: RawFlowDefinitionItem;
  dsl_json?: string;
};

type RawSaveFlowDefinitionRequest = {
  createdBy?: string;
  description?: string;
  flow: RawFlow;
};

type RawPublishFlowDefinitionRequest = {
  operator?: string;
};

type RawFlowTemplateResponse = {
  template_id?: string;
  name?: string;
  description?: string;
  flow_json?: string;
};

type RawCreateFlowFromTemplateResponse = {
  template_id?: string;
  definition?: RawFlowDefinitionItem;
};

type RawExecutionRequest = {
  dryRun?: boolean;
  flow?: RawFlow;
  flowDefinitionId?: string;
  input?: Record<string, unknown>;
  triggeredBy?: string;
};

type RawTraceStep = {
  description?: string;
  error?: string;
  finishedAt?: string;
  input?: Record<string, unknown>;
  nodeId?: string;
  nodeType?: string;
  output?: unknown;
  startedAt?: string;
  status?: string;
  transition?: string;
};

type RawExecutionResult = {
  executionId?: string;
  finishedAt?: string;
  flowDefinitionId?: string;
  flowId?: string;
  metadata?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt?: string;
  status?: string;
  trace?: RawTraceStep[];
  validation?: RawValidationResult;
  variables?: Record<string, unknown>;
};

type RawExecutionItem = {
  id?: string;
  flow_id?: string;
  flow_definition_id?: string;
  flow_version?: number;
  status?: string;
  trigger_source?: string;
  triggered_by?: string;
  input_payload?: string;
  output_payload?: string;
  variables_payload?: string;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
};

type RawExecutionStepItem = {
  id?: string;
  execution_id?: string;
  node_id?: string;
  node_type?: string;
  transition?: string;
  status?: string;
  input_payload?: string;
  output_payload?: string;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
};

type RawListExecutionsResponse = {
  executions?: RawExecutionItem[];
};

type RawGetExecutionDetailResponse = {
  execution?: RawExecutionItem;
  steps?: RawExecutionStepItem[];
};

export type DefaultTemplate = {
  templateId?: string;
  name?: string;
  description?: string;
  flow?: Flow | null;
  flowJson?: string;
};

type SaveDefinitionPayload =
  | RawSaveFlowDefinitionRequest
  | {
      createdBy?: string;
      created_by?: string;
      description?: string;
      definitionId?: string;
      dsl?: unknown;
      flow?: unknown;
      flowId?: string;
      id?: string;
      name?: string;
      version?: string | number;
    };

type ResultEnvelope<T> = {
  data?: T;
  result?: T;
  code?: number;
  message?: string;
};

function safeJsonParse<T>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseUnknownJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function unwrapResult<T>(res: T | ResultEnvelope<T>): T {
  if (!res || typeof res !== 'object') return res as T;
  const envelope = res as ResultEnvelope<T>;
  if ('data' in envelope || 'result' in envelope) {
    return (envelope.data ?? envelope.result ?? (res as T)) as T;
  }
  return res as T;
}

function toFlowDefinitionSummary(
  raw: RawFlowDefinitionItem | RawFlowDefinitionModel | undefined
): FlowDefinitionSummary {
  return {
    id: raw?.id != null ? String(raw.id) : '',
    flowId: raw?.flow_id ?? '',
    name: raw?.name,
    version: raw?.version,
    status: raw?.status,
    createdAt: raw?.created_at,
    updatedAt: raw?.updated_at,
    publishedBy: raw?.updated_by,
    description: raw?.description,
    publishedAt: raw?.published_at,
  };
}

function toCoreFlow(flow: Flow): RawFlow {
  return {
    id: flow.id,
    name: flow.name,
    version: flow.version,
    input: flow.input,
    nodes: (flow.nodes ?? []).map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      type: node.type,
      config: node.config ?? {},
    })),
    edges: (flow.edges ?? []).map((edge) => ({
      id: edge.id,
      from:
        (edge as { from?: string }).from ??
        (edge as { source?: string }).source ??
        '',
      to: (edge as { to?: string }).to ?? (edge as { target?: string }).target ?? '',
      label: (edge as { label?: string }).label,
      default: (edge as { default?: boolean }).default,
    })),
  };
}

function toAssetFlowDsl(flow: Flow): RawAssetFlowDefinitionDsl {
  return {
    id: flow.id,
    name: flow.name,
    version: String(flow.version ?? '1'),
    input_json: JSON.stringify(flow.input ?? {}),
    nodes: (flow.nodes ?? []).map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      type: node.type,
      config_json: JSON.stringify(node.config ?? {}),
    })),
    edges: (flow.edges ?? []).map((edge) => ({
      id: edge.id,
      from:
        (edge as { from?: string }).from ??
        (edge as { source?: string }).source ??
        '',
      to: (edge as { to?: string }).to ?? (edge as { target?: string }).target ?? '',
      label: (edge as { label?: string }).label,
      default: (edge as { default?: boolean }).default,
    })),
  };
}

function buildSaveFlowDefinitionRequest(body: SaveDefinitionPayload): RawSaveFlowDefinitionRequest {
  const candidate = (body as { dsl?: unknown }).dsl ?? (body as { flow?: unknown }).flow;
  const flowCandidate =
    (typeof candidate === 'string' ? safeJsonParse<Flow>(candidate) : (candidate as Flow)) ??
    ({
      id: (body as { flowId?: string }).flowId ?? 'new-flow',
      name: (body as { name?: string }).name ?? 'New Flow',
      version: String((body as { version?: string | number }).version ?? '1'),
      nodes: [],
      edges: [],
    } as Flow);

  const normalizedFlow: Flow = {
    id: flowCandidate.id ?? (body as { flowId?: string }).flowId ?? 'new-flow',
    name: flowCandidate.name ?? (body as { name?: string }).name ?? 'New Flow',
    version: String(flowCandidate.version ?? (body as { version?: string | number }).version ?? '1'),
    input: flowCandidate.input,
    nodes: (flowCandidate.nodes ?? []).map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      type: node.type as Flow['nodes'][number]['type'],
      config: toRecord(
        (node as { config?: Record<string, unknown> }).config ??
          parseUnknownJson((node as { config_json?: string }).config_json)
      ),
    })),
    edges: (flowCandidate.edges ?? []).map((edge) => ({
      id: edge.id ?? '',
      source:
        (edge as { source?: string }).source ??
        (edge as { from?: string }).from ??
        '',
      target:
        (edge as { target?: string }).target ?? (edge as { to?: string }).to ?? '',
    })),
  };

  return {
    createdBy:
      (body as { created_by?: string }).created_by ??
      (body as { createdBy?: string }).createdBy,
    description: body.description,
    flow: toCoreFlow(normalizedFlow),
  };
}

function toExecutionSummary(raw: RawExecutionItem): ExecutionSummary {
  return {
    id: raw.id ?? '',
    executionId: raw.id,
    flowId: raw.flow_id,
    status: raw.status,
    startedAt: raw.started_at ?? raw.created_at,
    finishedAt: raw.finished_at,
    createdAt: raw.created_at,
    error: raw.error_message,
  };
}

function toExecutionStep(raw: RawExecutionStepItem): ExecutionStep {
  return {
    id: raw.id,
    nodeId: raw.node_id,
    name: raw.node_id,
    status: raw.status,
    input: parseUnknownJson(raw.input_payload),
    output: parseUnknownJson(raw.output_payload),
    error: raw.error_message,
    startedAt: raw.started_at,
    finishedAt: raw.finished_at,
    nodeType: raw.node_type,
    transition: raw.transition,
  };
}

export function listDefinitions(params?: { flowId?: string }) {
  return request
    .get<RawListFlowDefinitionsResponse>(`${PREFIX}/definitions`, params)
    .then((raw) => {
      const res = unwrapResult(raw);
      return (res.definitions ?? []).map(toFlowDefinitionSummary);
    });
}

export function saveDefinition(body: SaveDefinitionPayload) {
  const payload = buildSaveFlowDefinitionRequest(body);
  return request
    .post<RawFlowDefinitionModel>(`${PREFIX}/definitions`, payload)
    .then((raw) => toFlowDefinitionSummary(unwrapResult(raw)) as FlowDefinitionDetail);
}

export function getDefinition(definitionId: string) {
  return request
    .get<RawGetFlowDefinitionResponse>(`${PREFIX}/definitions/${definitionId}`)
    .then((raw) => {
      const res = unwrapResult(raw);
      const detail = toFlowDefinitionSummary(res.definition) as FlowDefinitionDetail;
      detail.dsl =
        safeJsonParse<Flow>(res.dsl_json) ??
        safeJsonParse<Flow>(res.definition?.dsl) ??
        res.dsl_json ??
        res.definition?.dsl;
      return detail;
    });
}

export function publishDefinition(
  definitionId: string,
  body?: RawPublishFlowDefinitionRequest
) {
  return request
    .post<RawFlowDefinitionModel>(
      `${PREFIX}/definitions/${definitionId}/publish`,
      body ?? {}
    )
    .then((raw) => toFlowDefinitionSummary(unwrapResult(raw)) as FlowDefinitionDetail);
}

export function getPublished(flowId: string) {
  return request
    .get<RawGetFlowDefinitionResponse>(`${PREFIX}/published/${flowId}`)
    .then((raw) => {
      const res = unwrapResult(raw);
      const detail = toFlowDefinitionSummary(res.definition) as FlowDefinitionDetail;
      detail.dsl =
        safeJsonParse<Flow>(res.dsl_json) ??
        safeJsonParse<Flow>(res.definition?.dsl) ??
        res.dsl_json ??
        res.definition?.dsl;
      return detail;
    });
}

export function getDefaultTemplate() {
  return request.get<RawFlowTemplateResponse>(`${PREFIX}/templates/default`).then((raw) => {
    const res = unwrapResult(raw);
    return {
      templateId: res.template_id,
      name: res.name,
      description: res.description,
      flow: safeJsonParse<Flow>(res.flow_json),
      flowJson: res.flow_json,
    } as unknown;
  });
}

export function createDefinitionFromTemplate(body?: SaveDefinitionPayload) {
  const payload = body ? buildSaveFlowDefinitionRequest(body) : undefined;
  return request
    .post<RawCreateFlowFromTemplateResponse>(`${PREFIX}/definitions/from-template`, payload)
    .then((raw) => {
      const res = unwrapResult(raw);
      return {
        templateId: res.template_id,
        definition: toFlowDefinitionSummary(res.definition),
      };
    });
}

export function validateFlow(flow: Flow | Record<string, unknown>) {
  const payload = toCoreFlow(flow as Flow);
  return request
    .post<RawValidationResult>(`${PREFIX}/flows/validate`, payload)
    .then((raw) => {
      const res = unwrapResult(raw);
      const errors = (res.errors ?? [])
        .map((issue) => issue.message)
        .filter((msg): msg is string => Boolean(msg));
      const warnings = (res.warnings ?? [])
        .map((issue) => issue.message)
        .filter((msg): msg is string => Boolean(msg));
      return {
        valid: res.valid,
        errors,
        warnings,
        message: errors[0] ?? warnings[0],
      } as ValidateFlowResult;
    });
}

export function executeFlow(payload: ExecuteFlowPayload) {
  const body: RawExecutionRequest = {
    dryRun: Boolean((payload as { dryRun?: boolean }).dryRun),
    input: payload.input,
    triggeredBy: (payload as { triggeredBy?: string }).triggeredBy,
  };
  if (payload.flowDefinitionId) {
    body.flowDefinitionId = payload.flowDefinitionId;
  }
  if (payload.flow) {
    body.flow = toCoreFlow(payload.flow);
  }
  return request
    .post<RawExecutionResult>(`${PREFIX}/flows/execute`, body)
    .then((raw) => {
      const res = unwrapResult(raw);
      return {
        ...res,
        executionId: res.executionId,
      } as ExecuteFlowResult;
    });
}

export function listExecutions(params?: { flowId?: string }) {
  return request
    .get<RawListExecutionsResponse>(`${PREFIX}/executions`, params)
    .then((raw) => {
      const res = unwrapResult(raw);
      return (res.executions ?? []).map(toExecutionSummary);
    });
}

export function getExecution(executionId: string) {
  return request
    .get<RawGetExecutionDetailResponse>(`${PREFIX}/executions/${executionId}`)
    .then((raw) => {
      const res = unwrapResult(raw);
      const execution = res.execution;
      const detail: ExecutionDetail = {
        ...toExecutionSummary(execution ?? {}),
        input: parseUnknownJson(execution?.input_payload),
        output: parseUnknownJson(execution?.output_payload),
        variables: parseUnknownJson(execution?.variables_payload),
        error: execution?.error_message,
        steps: (res.steps ?? []).map(toExecutionStep),
      };
      return detail;
    });
}
