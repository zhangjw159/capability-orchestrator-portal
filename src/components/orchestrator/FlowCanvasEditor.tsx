'use client';

import {
  App,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
} from 'antd';
import TextArea from 'antd/es/input/TextArea';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';

import {
  applyPlanSkills,
  executeFlow,
  listGovernanceSkills,
  planFlow,
  saveDefinition,
  validateFlow,
} from '@/api/orchestrator';
import { listTools } from '@/api/tools';
import {
  collectForeachExclusiveNodeIds,
  extractToolsList,
  isValidationValid,
  normalizeSkillFieldInFlow,
  validateForeachExclusiveEdges,
} from '@/lib/orchestrator';
import { useOrchestratorPlanStore } from '@/store/orchestratorPlanStore';
import type {
  ApplyPlanStrategy,
  Flow,
  FlowNodeType,
  OrchestratorSkill,
  ValidationIssue,
} from '@/types/orchestrator';

const NODE_TYPES: Array<{
  type: FlowNodeType;
  label: string;
  description: string;
}> = [
  { type: 'start', label: 'start', description: '流程起点' },
  { type: 'end', label: 'end', description: '流程终点' },
  { type: 'set', label: 'set', description: '设置变量' },
  { type: 'template', label: 'template', description: '模板渲染' },
  { type: 'condition', label: 'condition', description: '条件判断' },
  { type: 'tool', label: 'tool', description: '调用 skill/tool' },
  { type: 'confirm', label: 'confirm', description: '人工确认分支' },
  { type: 'model', label: 'model', description: '模型推理' },
  {
    type: 'foreach',
    label: 'foreach',
    description: '遍历数组，依次执行步骤节点（步骤节点勿连线）',
  },
];

type Props = {
  definitionId?: string;
  initialFlow: Flow;
  skills: OrchestratorSkill[];
  readonlyFlowId?: boolean;
  onSaved?: () => void;
  onReloadDefinitionDsl?: () => Promise<Flow | null>;
};

const DEFAULT_FLOW_VERSION = 'flow/v1';

function buildDefaultNodeConfig(
  type: FlowNodeType,
  nodeId: string
): Record<string, unknown> {
  if (type === 'start' || type === 'end') {
    return {};
  }
  if (type === 'tool') {
    return {
      mode: 'skill',
      skillId: '',
      input: {},
      output: `${nodeId}_result`,
    };
  }
  if (type === 'condition') {
    return {
      condition: {
        op: 'contains',
        left: '$.output',
        right: '""',
      },
    };
  }
  if (type === 'template') {
    return {
      output: `${nodeId}_output`,
      template: '{{.input}}',
    };
  }
  if (type === 'model') {
    return {
      meta: {
        model: 'deepseek-chat',
        temperature: 0.2,
      },
      input: {},
      output: `${nodeId}_analysis`,
      prompt: '',
    };
  }
  if (type === 'set') {
    return {
      path: `${nodeId}_value`,
      value: '',
      parseJson: false,
    };
  }
  if (type === 'foreach') {
    return {
      sourcePath: 'work.items',
      itemPath: 'loop.item',
      indexPath: 'loop.index',
      steps: [] as string[],
      maxIterations: 32,
    };
  }
  if (type === 'confirm') {
    return {
      message: '请确认后继续',
      output: `${nodeId}_decision`,
    };
  }
  return {};
}

function buildDefaultNodeName(type: FlowNodeType): string {
  const map: Record<FlowNodeType, string> = {
    start: 'start',
    end: 'end',
    set: 'set value',
    template: 'render template',
    condition: 'check condition',
    tool: 'invoke skill',
    confirm: 'need confirm',
    model: 'model infer',
    foreach: 'foreach loop',
  };
  return map[type];
}

function normalizeEditorFlow(flow: Flow): Flow {
  const rawVersion = String(flow.version ?? '').trim();
  const normalizedVersion =
    !rawVersion ||
    rawVersion === '1' ||
    rawVersion === '1.0' ||
    rawVersion === 'v1'
      ? DEFAULT_FLOW_VERSION
      : rawVersion;
  return normalizeSkillFieldInFlow({
    ...flow,
    version: normalizedVersion,
    input:
      flow.input && typeof flow.input === 'object' && !Array.isArray(flow.input)
        ? flow.input
        : { output: {} },
  });
}

function parseJsonRecord(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('需为 JSON 对象');
  }
  return parsed as Record<string, unknown>;
}

function buildArgsTemplateFromSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {};
  const obj = schema as { properties?: Record<string, unknown> };
  const properties = obj.properties;
  if (!properties || typeof properties !== 'object') return {};
  return Object.keys(properties).reduce<Record<string, unknown>>((acc, key) => {
    const fieldSchema = properties[key] as Record<string, unknown> | undefined;
    const fieldType = String(fieldSchema?.type ?? '');
    if (fieldType === 'string') {
      acc[key] = `{{index .input "${key}"}}`;
    } else if (fieldType === 'integer' || fieldType === 'number') {
      acc[key] = 0;
    } else if (fieldType === 'boolean') {
      acc[key] = false;
    } else if (fieldType === 'array') {
      acc[key] = [];
    } else if (fieldType === 'object') {
      acc[key] = {};
    } else {
      acc[key] = '';
    }
    return acc;
  }, {});
}

function extractBodySchema(inputSchema: unknown): unknown {
  if (!inputSchema || typeof inputSchema !== 'object') return undefined;
  const root = inputSchema as Record<string, unknown>;
  const properties =
    root.properties && typeof root.properties === 'object'
      ? (root.properties as Record<string, unknown>)
      : undefined;
  if (properties?.body) return properties.body;
  if (root.bodySchema) return root.bodySchema;
  if (root.body && typeof root.body === 'object') {
    const body = root.body as Record<string, unknown>;
    if (body.schema) return body.schema;
  }
  if (root.requestBody && typeof root.requestBody === 'object') {
    const requestBody = root.requestBody as Record<string, unknown>;
    if (requestBody.content && typeof requestBody.content === 'object') {
      const content = requestBody.content as Record<string, unknown>;
      const jsonContent = content['application/json'];
      if (jsonContent && typeof jsonContent === 'object') {
        const jsonObj = jsonContent as Record<string, unknown>;
        if (jsonObj.schema) return jsonObj.schema;
      }
    }
  }
  return undefined;
}

function resolveArgsSchema(inputSchema: unknown): unknown {
  return extractBodySchema(inputSchema) ?? inputSchema;
}

function toEditableInput(
  configInput: unknown,
  _inputSchema: unknown
): Record<string, unknown> {
  if (!configInput || typeof configInput !== 'object') return {};
  return configInput as Record<string, unknown>;
}

function toConfigInput(
  editableInput: Record<string, unknown>,
  _inputSchema: unknown
): Record<string, unknown> {
  return editableInput;
}

const FlowNodeCard = ({
  data,
}: {
  data: { label?: string; isForeachBody?: boolean };
}) => (
  <div
    className={`rounded border px-3 py-2 text-xs shadow-sm ${
      data?.isForeachBody
        ? 'border-amber-400 bg-amber-50'
        : 'border-neutral-300 bg-white'
    }`}
  >
    <Handle
      type='target'
      position={Position.Top}
      style={{ width: 8, height: 8, background: '#1677ff' }}
    />
    <div className='text-neutral-800'>{data?.label ?? 'node'}</div>
    {data?.isForeachBody ? (
      <Tag color='orange' className='mt-1'>
        foreach 步骤
      </Tag>
    ) : null}
    <Handle
      type='source'
      position={Position.Bottom}
      style={{ width: 8, height: 8, background: '#1677ff' }}
    />
  </div>
);

function toCanvas(flow: Flow): { nodes: Node[]; edges: Edge[] } {
  const exclusive = collectForeachExclusiveNodeIds(flow);
  const nodes: Node[] = (flow.nodes ?? []).map((node, index) => ({
    id: node.id,
    position: {
      x: 120 + (index % 4) * 220,
      y: 80 + Math.floor(index / 4) * 120,
    },
    data: {
      label: node.name || `${node.type}:${node.id}`,
      isForeachBody: exclusive.has(node.id),
    },
    style: {
      borderRadius: 8,
      border: '1px solid #d9d9d9',
      padding: 6,
      width: 180,
    },
  }));
  const edges: Edge[] = (flow.edges ?? []).map((edge) => ({
    id: edge.id || uuidv4(),
    source:
      (edge as { source?: string; from?: string }).source ??
      (edge as { from?: string }).from ??
      '',
    target:
      (edge as { target?: string; to?: string }).target ??
      (edge as { to?: string }).to ??
      '',
    label: (edge as { label?: string }).label,
    data: {
      rawEdge: edge,
    },
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
  return { nodes, edges };
}

function toFlow(base: Flow, nodes: Node[], edges: Edge[]): Flow {
  const nodeMap = new Map(base.nodes.map((node) => [node.id, node]));
  return {
    ...normalizeEditorFlow(base),
    nodes: nodes.map((node) => {
      const original = nodeMap.get(node.id);
      return {
        id: node.id,
        type: (original?.type ?? 'set') as FlowNodeType,
        name: original?.name ?? String(node.data?.label ?? ''),
        description: original?.description,
        config: original?.config ?? {},
      };
    }),
    edges: edges.map((edge) => {
      const raw =
        edge.data &&
        typeof edge.data === 'object' &&
        'rawEdge' in (edge.data as Record<string, unknown>)
          ? ((edge.data as Record<string, unknown>).rawEdge as Record<
              string,
              unknown
            >)
          : {};
      const next: Record<string, unknown> = {
        ...raw,
        from: edge.source,
        to: edge.target,
      };
      if (typeof edge.label === 'string' && edge.label.trim()) {
        next.label = edge.label;
      } else {
        delete next.label;
      }
      delete next.source;
      delete next.target;
      return next as unknown as Flow['edges'][number];
    }),
  };
}

function normalizeConfirmEdgeLabels(
  inputEdges: Edge[],
  flowNodes: Array<{ id: string; type: FlowNodeType }>
): Edge[] {
  const confirmNodeIdSet = new Set(
    flowNodes.filter((node) => node.type === 'confirm').map((node) => node.id)
  );
  const grouped = new Map<string, Edge[]>();
  for (const edge of inputEdges) {
    if (!confirmNodeIdSet.has(edge.source)) continue;
    if (!grouped.has(edge.source)) grouped.set(edge.source, []);
    grouped.get(edge.source)?.push(edge);
  }

  const labeled = [...inputEdges];
  for (const [sourceId, outgoingEdges] of grouped.entries()) {
    const toCanonicalConfirmLabel = (
      label: unknown
    ): 'true' | 'false' | undefined => {
      if (label === true) return 'true';
      if (label === false) return 'false';
      if (typeof label !== 'string') return undefined;
      const normalized = label.trim().toLowerCase();
      if (normalized === 'true') return 'true';
      if (normalized === 'false') return 'false';
      return undefined;
    };

    const normalizedForNode = outgoingEdges.map((edge) => {
      const canonical = toCanonicalConfirmLabel(edge.label);
      if (canonical) return { ...edge, label: canonical };
      return edge;
    });
    const hasTrue = normalizedForNode.some((edge) => edge.label === 'true');
    const hasFalse = normalizedForNode.some((edge) => edge.label === 'false');
    const missing = normalizedForNode.filter(
      (edge) => edge.label !== 'true' && edge.label !== 'false'
    );

    const assignQueue: string[] = [];
    if (!hasTrue) assignQueue.push('true');
    if (!hasFalse) assignQueue.push('false');

    const replaced = normalizedForNode.map((edge) => {
      if (edge.label === 'true' || edge.label === 'false') return edge;
      const nextLabel = assignQueue.shift();
      return nextLabel ? { ...edge, label: nextLabel } : edge;
    });

    for (const edge of replaced) {
      const index = labeled.findIndex((item) => item.id === edge.id);
      if (index >= 0) labeled[index] = edge;
    }
    void sourceId;
    void missing;
  }
  return labeled;
}

function normalizeConditionEdgeLabels(
  inputEdges: Edge[],
  flowNodes: Array<{ id: string; type: FlowNodeType }>
): Edge[] {
  const conditionNodeIdSet = new Set(
    flowNodes.filter((node) => node.type === 'condition').map((node) => node.id)
  );
  const grouped = new Map<string, Edge[]>();
  for (const edge of inputEdges) {
    if (!conditionNodeIdSet.has(edge.source)) continue;
    if (!grouped.has(edge.source)) grouped.set(edge.source, []);
    grouped.get(edge.source)?.push(edge);
  }

  const labeled = [...inputEdges];
  for (const outgoingEdges of grouped.values()) {
    const hasTrue = outgoingEdges.some(
      (edge) => String(edge.label ?? '').trim().toLowerCase() === 'true'
    );
    const hasDefault = outgoingEdges.some(
      (edge) =>
        String(edge.label ?? '').trim().toLowerCase() === 'default' ||
        Boolean(
          (
            (edge.data as Record<string, unknown> | undefined)?.rawEdge as
              | Record<string, unknown>
              | undefined
          )?.default === true
        )
    );

    for (const edge of outgoingEdges) {
      const current = String(edge.label ?? '').trim().toLowerCase();
      const rawEdge =
        edge.data && typeof edge.data === 'object'
          ? ({
              ...((edge.data as Record<string, unknown>).rawEdge as Record<
                string,
                unknown
              >),
            } as Record<string, unknown>)
          : {};

      if (current === 'default') {
        rawEdge.default = true;
      } else if (!hasTrue) {
        edge.label = 'true';
      } else if (!hasDefault) {
        edge.label = 'default';
        rawEdge.default = true;
      }

      edge.data = {
        ...(edge.data as Record<string, unknown> | undefined),
        rawEdge,
      };
    }
  }
  return labeled;
}

function normalizeBranchEdgeLabels(
  inputEdges: Edge[],
  flowNodes: Array<{ id: string; type: FlowNodeType }>
): Edge[] {
  return normalizeConditionEdgeLabels(
    normalizeConfirmEdgeLabels(inputEdges, flowNodes),
    flowNodes
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function diffDsl(base: Flow, current: Flow): string[] {
  const lines: string[] = [];
  if (base.version !== current.version) lines.push('flow.version changed');
  if (base.id !== current.id) lines.push(`flow.id: ${base.id} -> ${current.id}`);
  if (base.name !== current.name) {
    lines.push(`flow.name: ${base.name} -> ${current.name}`);
  }
  if (stableStringify(base.input ?? {}) !== stableStringify(current.input ?? {})) {
    lines.push('flow.input changed');
  }

  const baseNodeMap = new Map(base.nodes.map((node) => [node.id, node]));
  const currentNodeMap = new Map(current.nodes.map((node) => [node.id, node]));
  for (const nodeId of baseNodeMap.keys()) {
    if (!currentNodeMap.has(nodeId)) lines.push(`node removed: ${nodeId}`);
  }
  for (const nodeId of currentNodeMap.keys()) {
    if (!baseNodeMap.has(nodeId)) lines.push(`node added: ${nodeId}`);
  }
  for (const [nodeId, node] of currentNodeMap.entries()) {
    const oldNode = baseNodeMap.get(nodeId);
    if (!oldNode) continue;
    if (oldNode.type !== node.type) lines.push(`node.type changed: ${nodeId}`);
    if ((oldNode.name ?? '') !== (node.name ?? '')) {
      lines.push(`node.name changed: ${nodeId}`);
    }
    if (stableStringify(oldNode.config ?? {}) !== stableStringify(node.config ?? {})) {
      lines.push(`node.config changed: ${nodeId}`);
    }
  }

  const normalizeEdge = (edge: Flow['edges'][number]) => ({
    id: edge.id ?? '',
    from: String((edge.from ?? edge.source ?? '') as string),
    to: String((edge.to ?? edge.target ?? '') as string),
    label: String((edge.label ?? '') as string),
    default: Boolean(edge.default),
  });
  const baseEdgeMap = new Map(base.edges.map((edge) => [edge.id, normalizeEdge(edge)]));
  const currentEdgeMap = new Map(
    current.edges.map((edge) => [edge.id, normalizeEdge(edge)])
  );
  for (const edgeId of baseEdgeMap.keys()) {
    if (!currentEdgeMap.has(edgeId)) lines.push(`edge removed: ${edgeId}`);
  }
  for (const edgeId of currentEdgeMap.keys()) {
    if (!baseEdgeMap.has(edgeId)) lines.push(`edge added: ${edgeId}`);
  }
  for (const [edgeId, edge] of currentEdgeMap.entries()) {
    const oldEdge = baseEdgeMap.get(edgeId);
    if (!oldEdge) continue;
    if (stableStringify(oldEdge) !== stableStringify(edge)) {
      lines.push(`edge changed: ${edgeId}`);
    }
  }
  return lines;
}

const FlowCanvasEditor = ({
  definitionId,
  initialFlow,
  skills,
  readonlyFlowId,
  onSaved,
  onReloadDefinitionDsl,
}: Props) => {
  const { message } = App.useApp();
  const router = useRouter();
  const [flowDraft, setFlowDraft] = useState<Flow>(initialFlow);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [validateIssues, setValidateIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [inputText, setInputText] = useState('{}');
  const [executeResult, setExecuteResult] = useState<unknown>(null);
  const [preferSkillExecutor, setPreferSkillExecutor] = useState(
    process.env.NEXT_PUBLIC_ORCHESTRATOR_PREFER_SKILL_EXECUTOR !== 'false'
  );
  const [toolOptions, setToolOptions] = useState<
    Array<{
      value: string;
      label: string;
      server?: string;
      name?: string;
      inputSchema?: unknown;
    }>
  >([]);
  const [toolInputText, setToolInputText] = useState('{}');
  const [governanceSkillOptions, setGovernanceSkillOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [toolInputError, setToolInputError] = useState<string | null>(null);
  const [refArgKey, setRefArgKey] = useState('');
  const [refOutputPath, setRefOutputPath] = useState('data');
  const [dslImportText, setDslImportText] = useState('');
  const [baselineFlow, setBaselineFlow] = useState<Flow>(initialFlow);
  const [dslDiffText, setDslDiffText] = useState('');
  const [planContextText, setPlanContextText] = useState('{}');
  const [planConstraintsText, setPlanConstraintsText] = useState('{}');
  const [applyPlanStrategy, setApplyPlanStrategy] =
    useState<ApplyPlanStrategy>('upsert');
  const [applyingPlan, setApplyingPlan] = useState(false);
  const {
    planInput,
    planResult,
    planStatus,
    validationSource,
    planErrorText,
    planRawResponse,
    setPlanInput,
    setPlanResult,
    setPlanStatus,
    setValidationSource,
    setPlanErrorText,
    setPlanRawResponse,
  } = useOrchestratorPlanStore();

  useEffect(() => {
    const normalizedInitial = normalizeEditorFlow(initialFlow);
    const mapped = toCanvas(normalizedInitial);
    setBaselineFlow(normalizedInitial);
    setFlowDraft(normalizedInitial);
    setNodes(mapped.nodes);
    setEdges(normalizeBranchEdgeLabels(mapped.edges, normalizedInitial.nodes));
    setDslDiffText('');
  }, [initialFlow]);

  useEffect(() => {
    setPlanContextText(JSON.stringify(planInput.context ?? {}, null, 2));
    setPlanConstraintsText(
      JSON.stringify(planInput.constraints ?? {}, null, 2)
    );
  }, [planInput.constraints, planInput.context]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await listTools();
        if (cancelled) return;
        const tools = extractToolsList(raw);
        setToolOptions(
          tools.map((tool) => ({
            value: String(tool.toolId ?? tool.id ?? ''),
            label: String(
              tool.displayName ?? tool.name ?? tool.toolId ?? tool.id ?? ''
            ),
            server: typeof tool.server === 'string' ? tool.server : undefined,
            name: typeof tool.name === 'string' ? tool.name : undefined,
            inputSchema: tool.inputSchema,
          }))
        );
      } catch {
        if (!cancelled) setToolOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listGovernanceSkills();
        if (cancelled) return;
        setGovernanceSkillOptions(
          list.map((item) => ({ value: item.id, label: item.name || item.id }))
        );
      } catch {
        if (!cancelled) setGovernanceSkillOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFlowDraft((prev) => toFlow(prev, nodes, edges));
  }, [nodes, edges]);

  const selectedNode = useMemo(
    () => flowDraft.nodes.find((node) => node.id === selectedNodeId),
    [flowDraft.nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId),
    [edges, selectedEdgeId]
  );
  const selectedToolOption = useMemo(() => {
    if (selectedNode?.type !== 'tool') return undefined;
    const toolId = String((selectedNode.config?.toolId as string) ?? '');
    if (!toolId) return undefined;
    return toolOptions.find((tool) => tool.value === toolId);
  }, [selectedNode, toolOptions]);
  useEffect(() => {
    if (selectedNode?.type !== 'tool') {
      setToolInputText('{}');
      setToolInputError(null);
      return;
    }
    const input = selectedNode.config?.input ?? selectedNode.config?.args;
    const editable = toEditableInput(input, selectedToolOption?.inputSchema);
    if (editable && Object.keys(editable).length > 0) {
      setToolInputText(JSON.stringify(editable, null, 2));
      setToolInputError(null);
      return;
    }
    setToolInputText('{}');
    setToolInputError(null);
  }, [selectedNode, selectedToolOption]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) =>
        normalizeBranchEdgeLabels(
          applyEdgeChanges(changes, current),
          flowDraft.nodes
        )
      );
    },
    [flowDraft.nodes]
  );
  const onConnect = useCallback(
    (connection: Edge | Connection) => {
      const source = String(connection.source ?? '');
      const target = String(connection.target ?? '');
      const synthetic = normalizeSkillFieldInFlow(
        toFlow(flowDraft, nodes, edges)
      );
      const exclusive = collectForeachExclusiveNodeIds(synthetic);
      if (exclusive.has(source) || exclusive.has(target)) {
        message.warning(
          'foreach 步骤节点只能通过 foreach.config.steps 调度，不能手动连线'
        );
        return;
      }
      setEdges((current) =>
        normalizeBranchEdgeLabels(
          addEdge(
            {
              ...connection,
              id: uuidv4(),
              markerEnd: { type: MarkerType.ArrowClosed },
            },
            current
          ),
          flowDraft.nodes
        )
      );
    },
    [edges, flowDraft, message, nodes]
  );

  const handleAddNode = useCallback(
    (type: FlowNodeType) => {
      const id = `${type}-${Math.random().toString(36).slice(2, 8)}`;
      const nextNode: Node = {
        id,
        position: {
          x: 120 + (nodes.length % 4) * 220,
          y: 80 + Math.floor(nodes.length / 4) * 120,
        },
        data: { label: `${type}-${id}` },
        style: {
          borderRadius: 8,
          border: '1px solid #d9d9d9',
          padding: 6,
          width: 180,
        },
      };
      setNodes((current) => [...current, nextNode]);
      setFlowDraft((prev) => ({
        ...prev,
        nodes: [
          ...prev.nodes,
          {
            id,
            type,
            name: buildDefaultNodeName(type),
            config: buildDefaultNodeConfig(type, id),
          },
        ],
      }));
      setSelectedNodeId(id);
    },
    [nodes.length]
  );

  const updateNode = useCallback(
    (patch: Partial<Flow['nodes'][number]>) => {
      if (!selectedNodeId) return;
      setFlowDraft((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === selectedNodeId ? { ...node, ...patch } : node
        ),
      }));
      if (patch.name) {
        setNodes((current) =>
          current.map((node) =>
            node.id === selectedNodeId
              ? { ...node, data: { ...node.data, label: patch.name } }
              : node
          )
        );
      }
    },
    [selectedNodeId]
  );

  const handleInsertReference = useCallback(() => {
    if (!selectedNode || selectedNode.type !== 'tool') return;
    if (!refArgKey.trim()) {
      message.warning('请填写目标参数名');
      return;
    }
    const outputPath = refOutputPath.trim() || refArgKey.trim();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(toolInputText) as Record<string, unknown>;
    } catch (error) {
      setToolInputError(
        `参数 JSON 无效：${error instanceof Error ? error.message : 'parse error'}`
      );
      return;
    }
    const next = {
      ...parsed,
      [refArgKey.trim()]: `{{index .input "${outputPath}"}}`,
    };
    setToolInputText(JSON.stringify(next, null, 2));
    setToolInputError(null);
    updateNode({
      config: {
        ...(selectedNode.config ?? {}),
        input: toConfigInput(next, selectedToolOption?.inputSchema),
      },
    });
    message.success('已插入 input 引用');
  }, [
    message,
    refArgKey,
    refOutputPath,
    selectedNode,
    selectedToolOption,
    toolInputText,
    updateNode,
  ]);

  const runValidate = useCallback(async () => {
    const local = validateForeachExclusiveEdges(flowDraft);
    const res = await validateFlow(flowDraft);
    const issues = [
      ...local,
      ...(res.errorIssues ?? []),
      ...(res.warningIssues ?? []),
    ];
    setValidateIssues(issues);
    const ok = local.length === 0 && res.valid !== false;
    if (!ok) {
      message.error(
        local.length > 0
          ? '存在 foreach 步骤节点连线（步骤节点不应出现在 edges）'
          : res.message || '校验未通过'
      );
    } else {
      message.success('校验通过');
    }
    return { ...res, valid: ok };
  }, [flowDraft, message]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // 保存前再次强规范 confirm 分支，避免 true/false 因空格或大小写导致执行期不匹配
      const normalizedEdges = normalizeBranchEdgeLabels(
        edges,
        flowDraft.nodes
      );
      const normalizedFlow = normalizeSkillFieldInFlow(
        toFlow(flowDraft, nodes, normalizedEdges)
      );
      const foreachIssues = validateForeachExclusiveEdges(normalizedFlow);
      if (foreachIssues.length > 0) {
        setValidateIssues(foreachIssues);
        message.error(
          '存在 foreach 步骤节点连线，请先删除相关边或在 foreach 中调整 steps'
        );
        return;
      }
      setEdges(normalizedEdges);
      setFlowDraft(normalizedFlow);
      const validation = await validateFlow(normalizedFlow);
      const issues = [
        ...(validation.errorIssues ?? []),
        ...(validation.warningIssues ?? []),
      ];
      setValidateIssues(issues);
      if (validation.valid === false) return;
      await saveDefinition({
        definitionId,
        id: definitionId,
        name: normalizedFlow.name,
        flowId: normalizedFlow.id,
        dsl: normalizedFlow,
      });
      setBaselineFlow(normalizedFlow);
      setDslDiffText('');
      message.success('保存成功');
      onSaved?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [definitionId, edges, flowDraft, message, nodes, onSaved, router]);

  const handleValidateAndExecute = useCallback(async () => {
    setExecuting(true);
    try {
      const validation = await runValidate();
      if (validation.valid === false) return;
      const input = JSON.parse(inputText) as Record<string, unknown>;
      const normalizedDraft = normalizeSkillFieldInFlow(flowDraft);
      const result = definitionId
        ? await executeFlow({
            flowDefinitionId: definitionId,
            input,
            executionOptions: { preferSkillExecutor },
          })
        : await executeFlow({
            flow: normalizedDraft,
            input,
            executionOptions: { preferSkillExecutor },
          });
      setExecuteResult(result);
      message.success('执行完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '执行失败');
    } finally {
      setExecuting(false);
    }
  }, [
    definitionId,
    flowDraft,
    inputText,
    message,
    preferSkillExecutor,
    runValidate,
  ]);

  const handleAutoConnect = useCallback(() => {
    if (nodes.length < 2) {
      message.warning('至少需要两个节点才能自动连线');
      return;
    }
    const sorted = [...nodes].sort((a, b) => {
      if (a.position.y !== b.position.y) return a.position.y - b.position.y;
      return a.position.x - b.position.x;
    });
    const generated: Edge[] = [];
    for (let i = 0; i < sorted.length - 1; i += 1) {
      generated.push({
        id: `auto-${sorted[i].id}-${sorted[i + 1].id}`,
        source: sorted[i].id,
        target: sorted[i + 1].id,
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }
    setEdges(normalizeBranchEdgeLabels(generated, flowDraft.nodes));
    message.success('已按节点顺序自动连线');
  }, [flowDraft.nodes, message, nodes]);

  const handleImportDsl = useCallback(() => {
    if (!dslImportText.trim()) {
      message.warning('请先粘贴 DSL JSON');
      return;
    }
    try {
      const parsed = JSON.parse(dslImportText) as Flow;
      if (
        !parsed ||
        !Array.isArray(parsed.nodes) ||
        !Array.isArray(parsed.edges)
      ) {
        message.error('DSL 需包含 nodes 与 edges 数组');
        return;
      }
      const normalized = normalizeEditorFlow(parsed);
      const mapped = toCanvas(normalized);
      setFlowDraft(normalized);
      setNodes(mapped.nodes);
      setEdges(normalizeBranchEdgeLabels(mapped.edges, normalized.nodes));
      setSelectedNodeId(undefined);
      setSelectedEdgeId(undefined);
      setBaselineFlow(normalized);
      setDslDiffText('');
      message.success('已根据 DSL 自动生成画板元素');
    } catch (error) {
      message.error(
        `DSL JSON 解析失败：${error instanceof Error ? error.message : 'parse error'}`
      );
    }
  }, [dslImportText, message]);

  const applyPlannedFlow = useCallback(
    (nextFlow?: Flow) => {
      if (!nextFlow) {
        message.warning('规划结果未包含可执行 flow');
        return;
      }
      const normalized = normalizeEditorFlow(nextFlow);
      const mapped = toCanvas(normalized);
      setFlowDraft(normalized);
      setNodes(mapped.nodes);
      setEdges(normalizeBranchEdgeLabels(mapped.edges, normalized.nodes));
      setSelectedNodeId(undefined);
      setSelectedEdgeId(undefined);
      setDslDiffText('');
      message.success('已将规划结果应用到画布');
    },
    [message]
  );

  const handleGeneratePlan = useCallback(async () => {
    const goal = planInput.goal?.trim();
    if (!goal) {
      message.warning('请先输入 goal');
      return;
    }
    setPlanStatus('loading');
    setPlanErrorText('');
    setPlanRawResponse(null);
    setPlanResult(null);
    try {
      const context = parseJsonRecord(planContextText);
      const constraints = parseJsonRecord(planConstraintsText);
      setPlanInput({ goal, context, constraints });
      const result = await planFlow({
        goal,
        context,
        constraints,
      });
      setPlanRawResponse(result.raw ?? null);
      setPlanResult(result.planResult ?? null);
      setValidationSource('langgraph');
      if (result.ok) {
        setPlanStatus('success');
        message.success('AI 规划完成');
        return;
      }
      if (result.planResult?.flow) {
        setPlanStatus('error');
        message.warning(
          result.message || '规划校验未通过，可选择继续应用后手工修复'
        );
        return;
      }
      setPlanStatus('error');
      setPlanErrorText(result.message || '规划失败');
      message.error(result.message || '规划失败');
    } catch (error) {
      const text = error instanceof Error ? error.message : '规划请求失败';
      setPlanStatus('error');
      setPlanErrorText(text);
      message.error(text);
    }
  }, [
    message,
    planConstraintsText,
    planContextText,
    planInput.goal,
    setPlanErrorText,
    setPlanInput,
    setPlanRawResponse,
    setPlanResult,
    setPlanStatus,
    setValidationSource,
  ]);

  const handleApplyPlanWithSkills = useCallback(async () => {
    if (!planResult?.flow) {
      message.warning('当前没有可应用的规划 Flow');
      return;
    }
    setApplyingPlan(true);
    try {
      const planSkills = Array.isArray(planResult.skills)
        ? planResult.skills
        : [];
      if (planSkills.length > 0) {
        const applyResult = await applyPlanSkills({
          strategy: applyPlanStrategy,
          reload: true,
          operator: 'portal',
          skills: planSkills as Array<Record<string, unknown>>,
        });
        if (applyResult.summary.conflicted > 0) {
          message.warning(
            `Skills 存在冲突（${applyResult.summary.conflicted}），请切换策略后重试`
          );
          return;
        }
      }
      applyPlannedFlow(planResult.flow);
      message.success('已应用规划：Flow + Skills');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '应用规划失败');
    } finally {
      setApplyingPlan(false);
    }
  }, [applyPlanStrategy, applyPlannedFlow, message, planResult]);

  const handleReloadDefinitionDsl = useCallback(async () => {
    if (!onReloadDefinitionDsl) return;
    try {
      const latest = await onReloadDefinitionDsl();
      if (!latest) {
        message.warning('未获取到可用 DSL');
        return;
      }
      const normalized = normalizeEditorFlow(latest);
      const mapped = toCanvas(normalized);
      setFlowDraft(normalized);
      setNodes(mapped.nodes);
      setEdges(normalizeBranchEdgeLabels(mapped.edges, normalized.nodes));
      setSelectedNodeId(undefined);
      setSelectedEdgeId(undefined);
      setBaselineFlow(normalized);
      setDslDiffText('');
      message.success('已从当前定义重新加载 DSL');
    } catch {
      message.error('重新加载 DSL 失败');
    }
  }, [message, onReloadDefinitionDsl]);

  const issueNodeIdSet = useMemo(
    () => new Set(validateIssues.map((issue) => issue.nodeId).filter(Boolean)),
    [validateIssues]
  );
  const planValid = useMemo(
    () => isValidationValid(planResult?.validation?.valid),
    [planResult?.validation?.valid]
  );
  const planNodeCount = planResult?.flow?.nodes?.length ?? 0;
  const planEdgeCount = planResult?.flow?.edges?.length ?? 0;
  const nodeTypes = useMemo(() => ({ cardNode: FlowNodeCard }), []);

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-12 gap-4'>
        <Card className='col-span-2' title='节点库' size='small'>
          <Space direction='vertical' className='w-full'>
            {NODE_TYPES.map((item) => (
              <Button
                key={item.type}
                block
                onClick={() => handleAddNode(item.type)}
              >
                <div className='flex flex-col items-start leading-tight'>
                  <span>{item.label}</span>
                  <span className='text-[11px] text-neutral-500'>
                    {item.description}
                  </span>
                </div>
              </Button>
            ))}
          </Space>
        </Card>
        <Card className='col-span-7' title='Flow 画布' size='small'>
          <div className='h-[560px]'>
            <ReactFlow
              nodes={nodes.map((node) =>
                issueNodeIdSet.has(node.id)
                  ? {
                      ...node,
                      style: { ...node.style, border: '1px solid #ff4d4f' },
                      type: 'cardNode',
                    }
                  : { ...node, type: 'cardNode' }
              )}
              nodeTypes={nodeTypes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(undefined);
              }}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(undefined);
              }}
              onPaneClick={() => {
                setSelectedNodeId(undefined);
                setSelectedEdgeId(undefined);
              }}
              fitView
            >
              <MiniMap />
              <Controls />
              <Background />
            </ReactFlow>
            <div className='mt-2 text-xs text-neutral-500'>
              连线方式：从节点上方/下方的蓝色圆点按住拖拽到目标节点圆点。
            </div>
          </div>
        </Card>
        <Card className='col-span-3' title='节点属性' size='small'>
          {selectedNode ? (
            <Form layout='vertical'>
              <Form.Item label='节点 ID'>
                <Input value={selectedNode.id} disabled />
              </Form.Item>
              <Form.Item label='节点类型'>
                <Select
                  value={selectedNode.type}
                  options={NODE_TYPES.map((item) => ({
                    value: item.type,
                    label: item.label,
                  }))}
                  onChange={(value) =>
                    updateNode({
                      type: value,
                      config: buildDefaultNodeConfig(value, selectedNode.id),
                      name: buildDefaultNodeName(value),
                    })
                  }
                />
              </Form.Item>
              <Form.Item label='节点名称'>
                <Input
                  value={selectedNode.name}
                  onChange={(e) => updateNode({ name: e.target.value })}
                />
              </Form.Item>
              {selectedNode.type === 'tool' ? (
                <>
                  <Form.Item label='tool.mode'>
                    <Select
                      value={String(
                        (selectedNode.config?.mode as string) ?? 'skill'
                      )}
                      options={[
                        { value: 'skill', label: 'skill' },
                        { value: 'tool', label: 'tool' },
                      ]}
                      onChange={(value) => {
                        const nextConfig = {
                          ...(selectedNode.config ?? {}),
                          mode: value,
                        };
                        if (value === 'skill') {
                          delete (nextConfig as Record<string, unknown>).toolId;
                          delete (nextConfig as Record<string, unknown>).server;
                          delete (nextConfig as Record<string, unknown>).tool;
                          delete (nextConfig as Record<string, unknown>).name;
                        } else {
                          delete (nextConfig as Record<string, unknown>).skill;
                        }
                        updateNode({ config: nextConfig });
                      }}
                    />
                  </Form.Item>
                  {String((selectedNode.config?.mode as string) ?? 'skill') ===
                  'skill' ? (
                    <Form.Item label='config.skillId'>
                      <Select
                        value={String(
                          (selectedNode.config?.skillId as string) ??
                            (selectedNode.config?.skill as string) ??
                            ''
                        )}
                        options={skills.map((skill) => ({
                          value: skill.skillId,
                          label: skill.skillId,
                        }))}
                        onChange={(value) =>
                          updateNode({
                            config: {
                              ...(selectedNode.config ?? {}),
                              skillId: value,
                              // backward compatible with old backend field name
                              skill: value,
                            },
                          })
                        }
                      />
                    </Form.Item>
                  ) : (
                    <>
                      <Form.Item label='toolId'>
                        <Select
                          showSearch
                          value={String(
                            (selectedNode.config?.toolId as string) ?? ''
                          )}
                          placeholder='请选择已注册 tool'
                          options={toolOptions}
                          onChange={(value) => {
                            const selected = toolOptions.find(
                              (tool) => tool.value === value
                            );
                            const schemaTemplate = buildArgsTemplateFromSchema(
                              resolveArgsSchema(selected?.inputSchema)
                            );
                            updateNode({
                              config: {
                                ...(selectedNode.config ?? {}),
                                toolId: value,
                                input:
                                  selectedNode.config?.input &&
                                  typeof selectedNode.config.input ===
                                    'object' &&
                                  Object.keys(
                                    selectedNode.config.input as Record<
                                      string,
                                      unknown
                                    >
                                  ).length > 0
                                    ? selectedNode.config.input
                                    : toConfigInput(
                                        schemaTemplate,
                                        selected?.inputSchema
                                      ),
                              },
                            });
                            setToolInputText(
                              JSON.stringify(schemaTemplate, null, 2)
                            );
                            setToolInputError(null);
                          }}
                        />
                      </Form.Item>
                      <Form.Item label='server'>
                        <Input
                          value={String(
                            (selectedNode.config?.server as string) ?? ''
                          )}
                          onChange={(e) =>
                            updateNode({
                              config: {
                                ...(selectedNode.config ?? {}),
                                server: e.target.value,
                              },
                            })
                          }
                        />
                      </Form.Item>
                      <Form.Item label='input(JSON)'>
                        <TextArea
                          rows={8}
                          value={toolInputText}
                          onChange={(e) => {
                            const next = e.target.value;
                            setToolInputText(next);
                            try {
                              const parsed = JSON.parse(next) as Record<
                                string,
                                unknown
                              >;
                              setToolInputError(null);
                              updateNode({
                                config: {
                                  ...(selectedNode.config ?? {}),
                                  input: toConfigInput(
                                    parsed,
                                    selectedToolOption?.inputSchema
                                  ),
                                },
                              });
                            } catch (error) {
                              setToolInputError(
                                `参数 JSON 无效：${error instanceof Error ? error.message : 'parse error'}`
                              );
                            }
                          }}
                          placeholder='根据所选工具 inputSchema 填写，例如 {"search_value":"{{index .input \"search_value\"}}"}'
                        />
                        {toolInputError ? (
                          <div className='mt-1 text-xs text-red-500'>
                            {toolInputError}
                          </div>
                        ) : selectedToolOption?.inputSchema ? (
                          <div className='mt-1 text-xs text-neutral-500'>
                            已按 body schema（若存在）/inputSchema
                            生成参数模板。
                          </div>
                        ) : (
                          <div className='mt-1 text-xs text-neutral-500'>
                            该工具未提供 inputSchema，手动填写参数。
                          </div>
                        )}
                        {selectedToolOption?.inputSchema ? (
                          <pre className='mt-2 max-h-32 overflow-auto rounded bg-neutral-50 p-2 text-xs'>
                            {JSON.stringify(
                              extractBodySchema(
                                selectedToolOption.inputSchema
                              ) ?? '该工具未提供 body schema',
                              null,
                              2
                            )}
                          </pre>
                        ) : null}
                      </Form.Item>
                      <Form.Item label='output'>
                        <Input
                          value={String(
                            (selectedNode.config?.output as string) ?? ''
                          )}
                          onChange={(e) =>
                            updateNode({
                              config: {
                                ...(selectedNode.config ?? {}),
                                output: e.target.value,
                              },
                            })
                          }
                          placeholder='例如 profile'
                        />
                      </Form.Item>
                      <Form.Item label='从指定 tool output 引用'>
                        <div className='flex flex-col gap-2'>
                          <Input
                            value={refArgKey}
                            onChange={(e) => setRefArgKey(e.target.value)}
                            placeholder='目标参数名，例如 userId'
                          />
                          <Input
                            value={refOutputPath}
                            onChange={(e) => setRefOutputPath(e.target.value)}
                            placeholder='input 键名，例如 search_value（默认同参数名）'
                          />
                          <Button onClick={handleInsertReference}>
                            插入到 input
                          </Button>
                          <div className='text-xs text-neutral-500'>
                            引用格式：{'{{index .input "search_value"}}'}
                          </div>
                        </div>
                      </Form.Item>
                    </>
                  )}
                  <Form.Item label='governance.skillIds'>
                    <Select
                      mode='multiple'
                      allowClear
                      value={
                        Array.isArray(selectedNode.config?.governanceSkillIds)
                          ? (selectedNode.config
                              ?.governanceSkillIds as string[])
                          : []
                      }
                      options={governanceSkillOptions}
                      onChange={(value) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            governanceSkillIds: value,
                          },
                        })
                      }
                    />
                  </Form.Item>
                  <Form.Item label='governance.mode'>
                    <Select
                      value={String(
                        (selectedNode.config?.governanceMode as string) ??
                          'warn'
                      )}
                      options={[
                        { value: 'warn', label: 'warn' },
                        { value: 'block', label: 'block' },
                        { value: 'human-confirm', label: 'human-confirm' },
                      ]}
                      onChange={(value) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            governanceMode: value,
                          },
                        })
                      }
                    />
                  </Form.Item>
                </>
              ) : null}
              {selectedNode.type === 'template' ? (
                <>
                  <Form.Item label='template'>
                    <TextArea
                      rows={4}
                      value={String(
                        (selectedNode.config?.template as string) ?? ''
                      )}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            template: e.target.value,
                          },
                        })
                      }
                      placeholder='例如 {{index .driver_list.list 0 "id"}}'
                    />
                  </Form.Item>
                  <Form.Item label='output'>
                    <Input
                      value={String(
                        (selectedNode.config?.output as string) ?? ''
                      )}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            output: e.target.value,
                          },
                        })
                      }
                      placeholder='例如 driver_id 或 output.summary'
                    />
                  </Form.Item>
                </>
              ) : null}
              {selectedNode.type === 'set' ? (
                <>
                  <Form.Item
                    label='config.path'
                    extra='与后端 set 一致；若历史 DSL 使用 output 可在 JSON 中保留，建议改为 path'
                  >
                    <Input
                      value={String(
                        (selectedNode.config?.path as string) ??
                          (selectedNode.config?.output as string) ??
                          ''
                      )}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = {
                          ...(selectedNode.config ?? {}),
                          path: v,
                        };
                        delete (next as Record<string, unknown>).output;
                        updateNode({ config: next });
                      }}
                      placeholder='例如 work.parsed 或 driver.id'
                    />
                  </Form.Item>
                  <Form.Item label='value（支持 Go 模板）'>
                    <TextArea
                      rows={4}
                      value={String((selectedNode.config?.value as string) ?? '')}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            value: e.target.value,
                          },
                        })
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    label='parseJson'
                    valuePropName='checked'
                    extra='为 true 时先将 value 当字符串做 JSON 解析，再写入 path'
                  >
                    <Switch
                      checked={Boolean(selectedNode.config?.parseJson)}
                      onChange={(checked) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            parseJson: checked,
                          },
                        })
                      }
                    />
                  </Form.Item>
                </>
              ) : null}
              {selectedNode.type === 'foreach' ? (
                <>
                  <Form.Item
                    label='sourcePath'
                    extra='变量中数组路径，可带 $. 前缀，如 work.order_groups'
                  >
                    <Input
                      value={String(
                        (selectedNode.config?.sourcePath as string) ?? ''
                      )}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            sourcePath: e.target.value,
                          },
                        })
                      }
                    />
                  </Form.Item>
                  <Form.Item label='itemPath' extra='每次迭代当前元素，如 loop.item'>
                    <Input
                      value={String(
                        (selectedNode.config?.itemPath as string) ?? ''
                      )}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            itemPath: e.target.value,
                          },
                        })
                      }
                    />
                  </Form.Item>
                  <Form.Item label='indexPath' extra='可选，0 起下标，如 loop.index'>
                    <Input
                      value={String(
                        (selectedNode.config?.indexPath as string) ?? ''
                      )}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            indexPath: e.target.value,
                          },
                        })
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    label='steps（节点 ID 顺序）'
                    extra='从本流程已存在的节点中多选；这些节点在图上不能有连线'
                  >
                    <Select
                      mode='multiple'
                      allowClear
                      style={{ width: '100%' }}
                      placeholder='选择要循环执行的节点'
                      value={
                        Array.isArray(selectedNode.config?.steps)
                          ? (selectedNode.config?.steps as string[])
                          : []
                      }
                      options={flowDraft.nodes
                        .filter(
                          (n) =>
                            n.id !== selectedNode.id &&
                            n.type !== 'foreach' &&
                            n.type !== 'start' &&
                            n.type !== 'end' &&
                            n.type !== 'condition' &&
                            n.type !== 'confirm'
                        )
                        .map((n) => ({
                          value: n.id,
                          label: `${n.type}: ${n.id}`,
                        }))}
                      onChange={(value) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            steps: value,
                          },
                        })
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    label='maxIterations'
                    extra='未设置时源数组超过 32 条仅执行前 32 次'
                  >
                    <InputNumber
                      min={1}
                      max={500}
                      value={
                        typeof selectedNode.config?.maxIterations === 'number'
                          ? (selectedNode.config
                              .maxIterations as number)
                          : undefined
                      }
                      onChange={(v) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            maxIterations: v ?? undefined,
                          },
                        })
                      }
                    />
                  </Form.Item>
                </>
              ) : null}
              {selectedNode.type === 'model' ? (
                <>
                  <Form.Item label='meta.model'>
                    <Input
                      value={String(
                        (
                          selectedNode.config?.meta as
                            | Record<string, unknown>
                            | undefined
                        )?.model ?? ''
                      )}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            meta: {
                              ...((selectedNode.config?.meta as Record<
                                string,
                                unknown
                              >) ?? {}),
                              model: e.target.value,
                            },
                          },
                        })
                      }
                      placeholder='例如 deepseek-chat'
                    />
                  </Form.Item>
                  <Form.Item label='meta.temperature'>
                    <Input
                      value={String(
                        (
                          selectedNode.config?.meta as
                            | Record<string, unknown>
                            | undefined
                        )?.temperature ?? ''
                      )}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            meta: {
                              ...((selectedNode.config?.meta as Record<
                                string,
                                unknown
                              >) ?? {}),
                              temperature: Number(e.target.value || 0),
                            },
                          },
                        })
                      }
                      placeholder='例如 0.2'
                    />
                  </Form.Item>
                  <Form.Item label='prompt'>
                    <TextArea
                      rows={6}
                      value={String(
                        (selectedNode.config?.prompt as string) ?? ''
                      )}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            prompt: e.target.value,
                          },
                        })
                      }
                    />
                  </Form.Item>
                  <Form.Item label='output'>
                    <Input
                      value={String(
                        (selectedNode.config?.output as string) ?? ''
                      )}
                      onChange={(e) =>
                        updateNode({
                          config: {
                            ...(selectedNode.config ?? {}),
                            output: e.target.value,
                          },
                        })
                      }
                      placeholder='例如 analysis'
                    />
                  </Form.Item>
                </>
              ) : null}
            </Form>
          ) : selectedEdge ? (
            <Form layout='vertical'>
              <Form.Item label='边 ID'>
                <Input value={selectedEdge.id} disabled />
              </Form.Item>
              <Form.Item label='from'>
                <Input value={selectedEdge.source} disabled />
              </Form.Item>
              <Form.Item label='to'>
                <Input value={selectedEdge.target} disabled />
              </Form.Item>
              <Form.Item label='label'>
                <Input
                  value={
                    typeof selectedEdge.label === 'string'
                      ? selectedEdge.label
                      : ''
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    setEdges((current) =>
                      current.map((edge) =>
                        edge.id === selectedEdge.id
                          ? { ...edge, label: value || undefined }
                          : edge
                      )
                    );
                  }}
                  placeholder='例如 true / false'
                />
              </Form.Item>
            </Form>
          ) : (
            <div className='text-neutral-500'>请先选择一个节点或一条边</div>
          )}
        </Card>
      </div>

      <Collapse
        defaultActiveKey={['plan', 'json', 'actions']}
        items={[
          {
            key: 'plan',
            label: 'AI 规划',
            children: (
              <div className='flex flex-col gap-3'>
                <Input
                  addonBefore='goal'
                  value={planInput.goal}
                  onChange={(e) => setPlanInput({ goal: e.target.value })}
                  placeholder='例如：给定订单号查询账单并输出用户摘要'
                />
                <TextArea
                  rows={4}
                  value={planContextText}
                  onChange={(e) => setPlanContextText(e.target.value)}
                  placeholder='context JSON，例如 {"tenant":"demo"}'
                />
                <TextArea
                  rows={4}
                  value={planConstraintsText}
                  onChange={(e) => setPlanConstraintsText(e.target.value)}
                  placeholder='constraints JSON，例如 {"maxNodes":8}'
                />
                <Space wrap>
                  <Button
                    type='primary'
                    loading={planStatus === 'loading'}
                    onClick={handleGeneratePlan}
                  >
                    生成 Flow
                  </Button>
                  {planResult?.flow ? (
                    <Button onClick={() => applyPlannedFlow(planResult.flow)}>
                      应用到画布
                    </Button>
                  ) : null}
                  {planResult?.flow ? (
                    <>
                      <Select
                        value={applyPlanStrategy}
                        style={{ minWidth: 170 }}
                        options={[
                          { value: 'upsert', label: 'upsert' },
                          { value: 'create_only', label: 'create_only' },
                          { value: 'skip_conflict', label: 'skip_conflict' },
                          {
                            value: 'rename_on_conflict',
                            label: 'rename_on_conflict',
                          },
                        ]}
                        onChange={(value) =>
                          setApplyPlanStrategy(value as ApplyPlanStrategy)
                        }
                      />
                      <Button
                        loading={applyingPlan}
                        onClick={() => void handleApplyPlanWithSkills()}
                      >
                        一键应用（Flow + Skills）
                      </Button>
                    </>
                  ) : null}
                  {planResult?.flow ? (
                    <Button
                      onClick={async () => {
                        const planFlow = planResult.flow as Flow;
                        const localFe = validateForeachExclusiveEdges(planFlow);
                        const validation = await validateFlow(planFlow);
                        setValidationSource('backend-validate');
                        const issues = [
                          ...localFe,
                          ...(validation.errorIssues ?? []),
                          ...(validation.warningIssues ?? []),
                        ];
                        setValidateIssues(issues);
                        if (validation.valid === false) {
                          message.warning(
                            validation.message || '后端校验未通过'
                          );
                        } else {
                          message.success('后端兜底校验通过');
                        }
                      }}
                    >
                      兜底校验
                    </Button>
                  ) : null}
                </Space>
                {planResult ? (
                  <div className='flex flex-wrap gap-2 text-xs'>
                    <Tag color={planValid ? 'success' : 'error'}>
                      {planValid ? 'valid=true' : 'valid=false'}
                    </Tag>
                    <Tag>nodes={planNodeCount}</Tag>
                    <Tag>edges={planEdgeCount}</Tag>
                    <Tag>validationSource={validationSource}</Tag>
                  </div>
                ) : null}
                {planResult?.validation?.errors?.length ? (
                  <pre className='max-h-48 overflow-auto rounded bg-red-50 p-3 text-xs'>
                    {JSON.stringify(planResult.validation.errors, null, 2)}
                  </pre>
                ) : null}
                {planResult?.validation?.warnings?.length ? (
                  <pre className='max-h-48 overflow-auto rounded bg-yellow-50 p-3 text-xs'>
                    {JSON.stringify(planResult.validation.warnings, null, 2)}
                  </pre>
                ) : null}
                {planErrorText ? (
                  <Tag color='error'>{planErrorText}</Tag>
                ) : null}
                {planRawResponse ? (
                  <pre className='max-h-64 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
                    {JSON.stringify(planRawResponse, null, 2)}
                  </pre>
                ) : null}
              </div>
            ),
          },
          {
            key: 'actions',
            label: '编辑动作',
            children: (
              <div className='flex flex-col gap-3'>
                <Space wrap>
                  <Button onClick={runValidate}>校验</Button>
                  <Button
                    onClick={() => {
                      const changes = diffDsl(baselineFlow, flowDraft);
                      if (changes.length === 0) {
                        setDslDiffText('与原始 DSL 一致（未检测到差异）');
                        message.success('DSL 回归校验通过');
                        return;
                      }
                      setDslDiffText(
                        changes
                          .map((line, index) => `${index + 1}. ${line}`)
                          .join('\n')
                      );
                      message.warning(`检测到 ${changes.length} 处 DSL 差异`);
                    }}
                  >
                    DSL 回归校验
                  </Button>
                  <Button onClick={handleAutoConnect}>一键自动连线</Button>
                  {onReloadDefinitionDsl ? (
                    <Button onClick={handleReloadDefinitionDsl}>
                      从当前定义重新加载 DSL
                    </Button>
                  ) : null}
                  <Button type='primary' loading={saving} onClick={handleSave}>
                    保存草稿
                  </Button>
                  <Button
                    type='primary'
                    danger
                    loading={executing}
                    onClick={handleValidateAndExecute}
                  >
                    校验并执行
                  </Button>
                </Space>
                <Input
                  addonBefore='flowId'
                  value={flowDraft.id}
                  disabled={readonlyFlowId}
                  onChange={(e) =>
                    setFlowDraft((prev) => ({ ...prev, id: e.target.value }))
                  }
                />
                <Input
                  addonBefore='flowName'
                  value={flowDraft.name}
                  onChange={(e) =>
                    setFlowDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
                <TextArea
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder='执行 input JSON'
                />
                <div className='flex items-center gap-2 text-xs text-neutral-600'>
                  <Switch
                    checked={preferSkillExecutor}
                    onChange={setPreferSkillExecutor}
                  />
                  <span>执行链路开关：优先使用 Skill Executor</span>
                </div>
                <TextArea
                  rows={8}
                  value={dslImportText}
                  onChange={(e) => setDslImportText(e.target.value)}
                  placeholder='粘贴完整 DSL JSON，点击“从 DSL 生成画板”'
                />
                <Space>
                  <Button onClick={handleImportDsl}>从 DSL 生成画板</Button>
                </Space>
                {validateIssues.length > 0 ? (
                  <div className='flex flex-wrap gap-2'>
                    {validateIssues.map((issue) => (
                      <Tag
                        key={`${issue.nodeId ?? ''}-${issue.edgeId ?? ''}-${issue.code ?? ''}-${issue.message ?? ''}`}
                        color={issue.nodeId ? 'error' : 'warning'}
                      >
                        {issue.nodeId
                          ? `节点 ${issue.nodeId}`
                          : issue.edgeId
                            ? `边 ${issue.edgeId}`
                            : '全局'}
                        :{issue.message}
                      </Tag>
                    ))}
                  </div>
                ) : null}
                {dslDiffText ? (
                  <pre className='max-h-56 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
                    {dslDiffText}
                  </pre>
                ) : null}
              </div>
            ),
          },
          {
            key: 'json',
            label: 'DSL JSON 预览',
            children: (
              <div className='flex flex-col gap-2'>
                <Tag color='blue'>
                  tool 节点 skill 模式使用 `config.skillId`（兼容保留
                  `config.skill`）
                </Tag>
                <pre className='max-h-80 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
                  {JSON.stringify(flowDraft, null, 2)}
                </pre>
              </div>
            ),
          },
          {
            key: 'result',
            label: '执行结果',
            children: (
              <pre className='max-h-80 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
                {executeResult
                  ? JSON.stringify(executeResult, null, 2)
                  : '暂无执行结果'}
              </pre>
            ),
          },
        ]}
      />
    </div>
  );
};

export default FlowCanvasEditor;
