export type FlowNodeType =
  | 'start'
  | 'end'
  | 'set'
  | 'template'
  | 'condition'
  | 'tool'
  | 'confirm'
  | 'model';

export interface FlowEdge {
  id: string;
  source?: string;
  target?: string;
  from?: string;
  to?: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface Flow {
  version: string;
  id: string;
  name: string;
  input?: Record<string, unknown>;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type FlowDefinitionStatus = string;

export interface FlowDefinitionSummary {
  id: string;
  flowId: string;
  name?: string;
  version?: string | number;
  status?: FlowDefinitionStatus;
  updatedAt?: string;
  publishedBy?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface FlowDefinitionDetail extends FlowDefinitionSummary {
  dsl?: Flow | string;
  [key: string]: unknown;
}

export interface ValidateFlowResult {
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
  errorIssues?: ValidationIssue[];
  warningIssues?: ValidationIssue[];
  message?: string;
  [key: string]: unknown;
}

export interface PlanInput {
  goal: string;
  context?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

export interface PlanValidation {
  valid?: boolean | string | number;
  errors?: unknown[];
  warnings?: unknown[];
  [key: string]: unknown;
}

export interface PlanResult {
  flow?: Flow;
  skills?: SkillDefinitionV1[];
  validation?: PlanValidation;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PlanFlowResponse {
  ok: boolean;
  statusCode?: number;
  planResult?: PlanResult;
  message?: string;
  raw?: unknown;
}

export interface ValidationIssue {
  code?: string;
  nodeId?: string;
  edgeId?: string;
  message?: string;
}

export interface ExecuteFlowPayload {
  flowDefinitionId?: string;
  flow?: Flow;
  input?: Record<string, unknown>;
  executionOptions?: {
    preferSkillExecutor?: boolean;
  };
}

export interface ExecuteFlowResult {
  executionId?: string;
  output?: unknown;
  trace?: unknown;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ExecutionSummary {
  id: string;
  executionId?: string;
  flowId?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ExecutionDetail extends ExecutionSummary {
  steps?: ExecutionStep[];
  input?: unknown;
  output?: unknown;
  trace?: unknown;
  error?: unknown;
  [key: string]: unknown;
}

export interface ExecutionStep {
  id?: string;
  nodeId?: string;
  name?: string;
  status?: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  startedAt?: string;
  finishedAt?: string;
  [key: string]: unknown;
}

export interface RegisteredTool {
  id?: string;
  toolId?: string;
  name?: string;
  displayName?: string;
  server?: string;
  source?: string;
  description?: string;
  discoveredAt?: string;
  inputSchema?: unknown;
  [key: string]: unknown;
}

export interface OrchestratorSkill {
  id?: string;
  skillId: string;
  name?: string;
  status?: string;
  definition?: Record<string, unknown>;
  binding?: Record<string, unknown>;
  runtimePolicy?: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  updatedAt?: string;
  createdAt?: string;
}

export type ApplyPlanStrategy =
  | 'upsert'
  | 'create_only'
  | 'skip_conflict'
  | 'rename_on_conflict';

export interface ApplyPlanSkillsRequest {
  skills: Record<string, unknown>[];
  strategy?: ApplyPlanStrategy;
  reload?: boolean;
  operator?: string;
}

export interface ApplyPlanSkillsResult {
  skillId: string;
  action: 'created' | 'updated' | 'skipped' | 'conflicted';
  reason?: string;
  finalSkillId?: string;
}

export interface ApplyPlanSkillsResponse {
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    conflicted: number;
  };
  results: ApplyPlanSkillsResult[];
  reloaded: boolean;
}

export type JsonSchema = Record<string, unknown>;

export type SkillBinding =
  | {
      type: 'mcp-tool';
      server: string;
      toolName: string;
      toolId?: string;
      defaultArgs?: Record<string, unknown>;
    }
  | {
      type: 'http';
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      url: string;
      headers?: Record<string, string>;
    };

export interface SkillRuntimePolicy {
  timeoutMs: number;
  retry: {
    maxAttempts: number;
    backoffMs: number;
    retryableCodes?: string[];
  };
  concurrency?: {
    maxInFlight?: number;
    keyBy?: 'tenant' | 'skill' | 'flow';
  };
}

export interface SkillGovernance {
  owner: string;
  visibility: 'public' | 'internal' | 'private';
  allowedTenants?: string[];
  tags?: string[];
}

export type SkillStatus = 'enabled' | 'disabled' | 'deprecated';

export interface SkillDefinitionV1 {
  skillId: string;
  name: string;
  description?: string;
  version: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  binding: SkillBinding;
  runtimePolicy: SkillRuntimePolicy;
  governance: SkillGovernance;
  status: SkillStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InvokeSkillContext {
  traceId: string;
  tenantId?: string;
  userId?: string;
  flowId?: string;
  executionId?: string;
  nodeId?: string;
}

export interface InvokeSkillRequest {
  arguments: Record<string, unknown>;
  context: InvokeSkillContext;
}

export interface InvokeSkillError {
  code:
    | 'SKILL_BAD_ARGS'
    | 'SKILL_TIMEOUT'
    | 'SKILL_UNAVAILABLE'
    | 'SKILL_PERMISSION_DENIED'
    | 'SKILL_UPSTREAM_ERROR';
  message: string;
  retriable: boolean;
}

export interface InvokeSkillResponse {
  ok: boolean;
  result?: unknown;
  error?: InvokeSkillError;
  meta: {
    traceId: string;
    skillId: string;
    latencyMs: number;
    upstream?: {
      type: string;
      server?: string;
      toolName?: string;
      statusCode?: number;
    };
    governance?: {
      mode?: string;
      passed: number;
      total: number;
      blocked: boolean;
      pending?: boolean;
      decisionToken?: string;
      checks?: GovernanceReviewResponse[];
      issues?: string[];
    };
  };
}

export interface GovernanceSkill {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  content?: string;
  checklist?: string[];
  runtimeSkillIds?: string[];
  status?: string;
  version?: string;
  meta?: Record<string, unknown>;
}

export interface GovernanceReviewChecklistItem {
  key: string;
  passed: boolean;
  message?: string;
}

export interface GovernanceReviewResponse {
  decision: {
    businessIdRequired: boolean;
    businessIdSource?: string;
    searchBehavior: {
      driverName: string;
      nric: string;
      phone: string;
      multiField: string;
    };
    dataScope: {
      constrainedByBusinessId: boolean;
      crossBusinessLeakage: boolean;
    };
  };
  checklist: GovernanceReviewChecklistItem[];
  passed: number;
  total: number;
  openIssues?: string[];
}

export interface GovernanceReportItem {
  executionId: string;
  flowId?: string;
  mode?: string;
  passed: number;
  total: number;
  blocked: boolean;
  issues?: string[];
}

export interface GovernanceReportResponse {
  summary: {
    totalExecutions: number;
    withGovernance: number;
    blocked: number;
    passedChecks: number;
    totalChecks: number;
  };
  items: GovernanceReportItem[];
}

export interface GovernanceDecision {
  token: string;
  skillId?: string;
  runtimeSkillId?: string;
  mode?: string;
  status: string;
  issues?: string[];
  operator?: string;
  comment?: string;
  createdAt: string;
  decidedAt?: string;
}
