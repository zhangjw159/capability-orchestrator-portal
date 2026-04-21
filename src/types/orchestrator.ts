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
  source: string;
  target: string;
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
  skillId: string;
  name?: string;
  status?: string;
  definition?: Record<string, unknown>;
  updatedAt?: string;
  createdAt?: string;
}
