'use client';

import { PageContainer } from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  Divider,
  Form,
  Input,
  List,
  Space,
  Table,
  Tag,
} from 'antd';
import TextArea from 'antd/es/input/TextArea';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  copyThreadDirectLanggraph,
  createAssistantDirectLanggraph,
  createThreadDirectLanggraph,
  getStudioInfo,
  getThreadStateDirectLanggraph,
  runWaitDirectLanggraph,
  runWaitOnThreadDirectLanggraph,
  searchAssistants,
  searchThreads,
  updateThreadStateDirectLanggraph,
} from '@/api/studio';
import StudioGraphPlayground from '@/components/orchestrator/StudioGraphPlayground';
import { useStudioStore } from '@/store/studioStore';
import type {
  StudioRunRecord,
  StudioRunWaitRequest,
  StudioThread,
} from '@/types/studio';

const DEFAULT_LANGGRAPH_BASE_URL =
  process.env.NEXT_PUBLIC_LANGGRAPH_BASE_URL ?? 'http://127.0.0.1:8123';
const DEFAULT_LANGGRAPH_PATH =
  process.env.NEXT_PUBLIC_LANGGRAPH_PATH ?? '/runs/wait';
const DEFAULT_LANGGRAPH_ASSISTANT_ID =
  process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID ?? 'agent';
const DEFAULT_LANGGRAPH_ASSISTANTS_PATH =
  process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANTS_PATH ?? '/assistants';
const DEFAULT_LANGGRAPH_TIMEOUT_MS =
  process.env.NEXT_PUBLIC_LANGGRAPH_TIMEOUT_MS ?? '60000';
const DEFAULT_LANGGRAPH_HEADERS =
  process.env.NEXT_PUBLIC_LANGGRAPH_HEADERS_JSON ?? '{}';

function parseJsonObject(raw: string): Record<string, unknown> {
  const text = raw.trim();
  if (!text) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON 需为对象');
  }
  return parsed as Record<string, unknown>;
}

function parseInterruptSetting(raw: string): '*' | string[] | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  if (text === '*') return '*';
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed === '*') return '*';
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item ?? '').trim())
        .filter((item) => Boolean(item));
    }
  } catch {
    const list = text
      .split(',')
      .map((item) => item.trim())
      .filter((item) => Boolean(item));
    if (list.length) return list;
  }
  return undefined;
}

function pickStringField(
  record: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = record[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return '-';
}

function pickOptionalString(
  record: Record<string, unknown>,
  keys: string[]
): string | undefined {
  const value = pickStringField(record, keys);
  return value === '-' ? undefined : value;
}

function pickNumberField(
  record: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function extractRunSteps(
  response: Record<string, unknown>
): Array<Record<string, unknown>> {
  const candidates = [
    response.steps,
    response.trace,
    toRecord(response.run).steps,
    toRecord(response.run).trace,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item) => item && typeof item === 'object' && !Array.isArray(item)
      ) as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function buildGraphFromRunResponse(
  response: Record<string, unknown>
): Record<string, unknown> {
  const steps = extractRunSteps(response);
  if (!steps.length) {
    return { nodes: [], edges: [] };
  }
  const nodes = steps.map((step, index) => {
    const nodeId =
      pickOptionalString(step, ['node_id', 'node', 'name']) ??
      `step-${index + 1}`;
    const nodeType = pickOptionalString(step, ['node_type', 'type']) ?? 'step';
    const status = pickOptionalString(step, ['status', 'state']) ?? 'unknown';
    return {
      id: nodeId,
      type: nodeType,
      status,
      label: `${nodeId} [${status}]`,
      position: {
        x: 120 + (index % 4) * 220,
        y: 80 + Math.floor(index / 4) * 140,
      },
    };
  });
  const stepEdges = nodes
    .slice(0, -1)
    .map((node, index) => ({
      id: `edge-${node.id}-${nodes[index + 1]?.id ?? index}`,
      source: node.id,
      target: nodes[index + 1]?.id ?? '',
      label: `step-${index + 1}`,
    }))
    .filter((edge) => edge.source && edge.target);
  const firstNodeId = nodes[0]?.id;
  const lastNodeId = nodes[nodes.length - 1]?.id;
  const startNode = {
    id: 'start',
    type: 'start',
    status: 'success',
    label: 'start',
    position: { x: 40, y: 20 },
  };
  const endNode = {
    id: 'end',
    type: 'end',
    status: 'success',
    label: 'end',
    position: {
      x: 120 + ((nodes.length + 1) % 4) * 220,
      y: 80 + Math.floor((nodes.length + 1) / 4) * 140,
    },
  };
  const boundaryEdges = [
    firstNodeId
      ? {
          id: `edge-start-${firstNodeId}`,
          source: 'start',
          target: firstNodeId,
          label: 'start',
        }
      : null,
    lastNodeId
      ? {
          id: `edge-${lastNodeId}-end`,
          source: lastNodeId,
          target: 'end',
          label: 'end',
        }
      : null,
  ].filter(Boolean);
  return {
    nodes: [startNode, ...nodes, endNode],
    edges: [...boundaryEdges, ...stepEdges],
  };
}

function pickAssistantIdFromCreateResult(
  raw: Record<string, unknown>
): string | undefined {
  const direct = pickOptionalString(raw, ['assistant_id', 'id']);
  if (direct) return direct;
  const data = toRecord(raw.data);
  const result = toRecord(raw.result);
  return (
    pickOptionalString(data, ['assistant_id', 'id']) ??
    pickOptionalString(result, ['assistant_id', 'id'])
  );
}

function resolveCreateAssistantError(error: unknown): string {
  const response = error as {
    status?: number;
    data?: { message?: unknown; error?: unknown; detail?: unknown };
    requestPath?: string;
  };
  const status = response?.status;
  const requestPath = response?.requestPath;
  const backendMessage =
    response?.data?.message != null
      ? String(response.data.message)
      : response?.data?.error != null
        ? String(response.data.error)
        : response?.data?.detail != null
          ? String(response.data.detail)
        : '';

  if (status === 404 || status === 405) {
    return backendMessage
      ? `LangGraph assistant 创建接口不可用（${requestPath ?? '/assistants'}）。上游返回：${backendMessage}`
      : `LangGraph assistant 创建接口不可用（${requestPath ?? '/assistants'}）。`;
  }
  if (status === 400) {
    return backendMessage
      ? `创建 assistant 参数不合法：${backendMessage}`
      : '创建 assistant 参数不合法（400）。';
  }
  if (status === 401 || status === 403) {
    return backendMessage
      ? `无权限创建 assistant：${backendMessage}`
      : '无权限创建 assistant（401/403）。';
  }
  if (backendMessage) return `创建 assistant 失败：${backendMessage}`;
  return '创建 assistant 失败，请检查 LangGraph 的 /assistants 路由与鉴权。';
}

const StudioPage = () => {
  const { message } = App.useApp();
  const {
    assistants,
    selectedAssistantId,
    lastRunRequest,
    lastRunResponse,
    runHistory,
    selectedRunId,
    threads,
    setAssistants,
    setSelectedAssistantId,
    setLastRunRequest,
    setLastRunResponse,
    addRunRecord,
    setSelectedRunId,
    setThreads,
  } = useStudioStore();

  const [loadingInfo, setLoadingInfo] = useState(false);
  const [studioInfo, setStudioInfo] = useState<Record<string, unknown> | null>(
    null
  );
  const [assistantsQueryText, setAssistantsQueryText] =
    useState('{"limit":20}');
  const [assistantCreateText, setAssistantCreateText] = useState(
    '{"graph_id":"agent","name":"new-assistant","metadata":{"env":"dev"}}'
  );
  const [creatingAssistant, setCreatingAssistant] = useState(false);
  const [runInputText, setRunInputText] = useState('{}');
  const [runMetadataText, setRunMetadataText] = useState('{}');
  const [runCommandText, setRunCommandText] = useState('{}');
  const [interruptBeforeText, setInterruptBeforeText] = useState('');
  const [interruptAfterText, setInterruptAfterText] = useState('');
  const [running, setRunning] = useState(false);
  const [langgraphBaseUrl] = useState(DEFAULT_LANGGRAPH_BASE_URL);
  const [langgraphPath] = useState(DEFAULT_LANGGRAPH_PATH);
  const [langgraphAssistantId] = useState(DEFAULT_LANGGRAPH_ASSISTANT_ID);
  const [langgraphAssistantsPath] = useState(DEFAULT_LANGGRAPH_ASSISTANTS_PATH);
  const [langgraphTimeoutMs] = useState(DEFAULT_LANGGRAPH_TIMEOUT_MS);
  const [langgraphHeadersText] = useState(DEFAULT_LANGGRAPH_HEADERS);
  const [threadsQueryText, setThreadsQueryText] = useState('{"limit":20}');
  const [threadCreateText, setThreadCreateText] = useState(
    '{"metadata":{"source":"studio-console"}}'
  );
  const [creatingThread, setCreatingThread] = useState(false);
  const [forkingThread, setForkingThread] = useState(false);
  const [statefulThreadMode, setStatefulThreadMode] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingThreadState, setLoadingThreadState] = useState(false);
  const [updatingThreadState, setUpdatingThreadState] = useState(false);
  const [threadStateText, setThreadStateText] = useState('{}');
  const [threadStateUpdateText, setThreadStateUpdateText] = useState(
    '{"values":{},"as_node":"agent"}'
  );
  const [selectedThread, setSelectedThread] = useState<StudioThread | null>(
    null
  );
  const [graphDraft, setGraphDraft] = useState<Record<string, unknown>>({
    nodes: [],
    edges: [],
  });
  const [graphSeed, setGraphSeed] = useState<Record<string, unknown> | null>(
    null
  );
  const [graphApplyToken, setGraphApplyToken] = useState(0);

  const selectedAssistant = useMemo(
    () =>
      assistants.find(
        (assistant) => assistant.assistant_id === selectedAssistantId
      ),
    [assistants, selectedAssistantId]
  );
  const selectedRun = useMemo<StudioRunRecord | null>(
    () => runHistory.find((item) => item.id === selectedRunId) ?? null,
    [runHistory, selectedRunId]
  );
  const inspectorResponseRecord = useMemo(
    () =>
      (selectedRun?.response ?? lastRunResponse ?? {}) as Record<
        string,
        unknown
      >,
    [lastRunResponse, selectedRun?.response]
  );
  const runStatus = pickStringField(inspectorResponseRecord, [
    'status',
    'state',
  ]);
  const normalizedRunStatus = runStatus.trim().toLowerCase();
  const canResumeByStatus = [
    'interrupted',
    'paused',
    'waiting_for_resume',
    'awaiting_resume',
  ].includes(normalizedRunStatus);
  const runError = pickStringField(inspectorResponseRecord, [
    'error',
    'message',
    'error_message',
  ]);
  const runStartedAt = pickStringField(inspectorResponseRecord, [
    'started_at',
    'start_time',
    'created_at',
  ]);
  const runFinishedAt = pickStringField(inspectorResponseRecord, [
    'finished_at',
    'end_time',
    'completed_at',
  ]);
  const runLatencyMs = pickNumberField(inspectorResponseRecord, [
    'latency_ms',
    'duration_ms',
    'elapsed_ms',
  ]);
  const promptTokens = pickNumberField(inspectorResponseRecord, [
    'prompt_tokens',
    'input_tokens',
  ]);
  const completionTokens = pickNumberField(inspectorResponseRecord, [
    'completion_tokens',
    'output_tokens',
  ]);
  const totalTokens = pickNumberField(inspectorResponseRecord, [
    'total_tokens',
  ]);
  const runSteps = useMemo(
    () => extractRunSteps(inspectorResponseRecord),
    [inspectorResponseRecord]
  );
  const selectedThreadTimeline = useMemo(() => {
    if (!selectedThread) return [];
    const source = selectedThread as Record<string, unknown>;
    const candidates = [
      source.runs,
      source.history,
      toRecord(source.state).runs,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate
          .filter(
            (item) => item && typeof item === 'object' && !Array.isArray(item)
          )
          .map((item) => item as Record<string, unknown>);
      }
    }
    return [];
  }, [selectedThread]);
  const selectedThreadId = useMemo(
    () =>
      selectedThread
        ? (pickOptionalString(selectedThread as Record<string, unknown>, [
            'thread_id',
            'id',
          ]) ?? '')
        : '',
    [selectedThread]
  );
  const runUsesGraphDraft = useMemo(() => {
    if (!lastRunRequest) return false;
    const metadata = toRecord(
      (lastRunRequest as Record<string, unknown>).metadata
    );
    return Boolean(metadata.graph_draft);
  }, [lastRunRequest]);

  const applyGraphFromResponse = useCallback(
    (response: Record<string, unknown>, sourceLabel: string) => {
      const nextGraph = buildGraphFromRunResponse(response);
      const nextNodes = Array.isArray(nextGraph.nodes)
        ? nextGraph.nodes.length
        : 0;
      setGraphDraft(nextGraph);
      setGraphSeed(nextGraph);
      setGraphApplyToken((prev) => prev + 1);
      if (nextNodes > 0) {
        message.success(
          `已根据 ${sourceLabel} 生成 ${nextNodes} 个节点的画布草稿`
        );
      } else {
        message.warning(`${sourceLabel} 未包含可解析 steps/trace，已清空草稿`);
      }
    },
    [message]
  );

  const loadStudioInfo = useCallback(async () => {
    setLoadingInfo(true);
    try {
      const info = await getStudioInfo();
      setStudioInfo(info);
    } catch {
      message.error('获取 Studio 信息失败');
    } finally {
      setLoadingInfo(false);
    }
  }, [message]);

  const loadAssistants = useCallback(async () => {
    try {
      const payload = parseJsonObject(assistantsQueryText);
      const list = await searchAssistants(payload);
      setAssistants(list);
      if (!selectedAssistantId && list[0]?.assistant_id) {
        setSelectedAssistantId(list[0].assistant_id);
      }
      message.success(`已加载 ${list.length} 个 assistants`);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : '查询 assistants 失败'
      );
    }
  }, [
    assistantsQueryText,
    message,
    selectedAssistantId,
    setAssistants,
    setSelectedAssistantId,
  ]);

  const handleCreateAssistant = useCallback(async () => {
    setCreatingAssistant(true);
    try {
      const payload = parseJsonObject(assistantCreateText);
      if (!payload.graph_id) {
        payload.graph_id = langgraphAssistantId;
      }
      const created = await createAssistantDirectLanggraph(payload, {
        baseUrl: langgraphBaseUrl,
        path: langgraphAssistantsPath,
        timeoutMs: Number(langgraphTimeoutMs || 60000),
        headers: parseJsonObject(langgraphHeadersText) as Record<
          string,
          string
        >,
      });
      const assistantId = pickAssistantIdFromCreateResult(created);
      await loadAssistants();
      if (assistantId) {
        setSelectedAssistantId(assistantId);
      }
      message.success(
        assistantId ? `assistant 已创建：${assistantId}` : 'assistant 创建成功'
      );
    } catch (error) {
      const failedUrl = `${langgraphBaseUrl.replace(/\/+$/, '')}${langgraphAssistantsPath.startsWith('/') ? langgraphAssistantsPath : `/${langgraphAssistantsPath}`}`;
      const baseErr = resolveCreateAssistantError(error);
      message.error(`${baseErr}（请求地址：${failedUrl}）`);
    } finally {
      setCreatingAssistant(false);
    }
  }, [
    assistantCreateText,
    langgraphAssistantId,
    langgraphAssistantsPath,
    langgraphBaseUrl,
    langgraphHeadersText,
    langgraphTimeoutMs,
    loadAssistants,
    message,
    setSelectedAssistantId,
  ]);

  const buildMetadataForRun = useCallback(
    (withGraphDraft: boolean) => {
      const metadata = parseJsonObject(runMetadataText);
      if (!withGraphDraft) return metadata;
      return {
        ...metadata,
        execution_source: 'graph_draft',
        graph_draft_version: 'flow/v1',
        graph_draft: graphDraft,
      };
    },
    [graphDraft, runMetadataText]
  );

  const handleRunWait = useCallback(async (withGraphDraft = false) => {
    const assistantId = (selectedAssistantId ?? langgraphAssistantId).trim();
    if (!assistantId) {
      message.warning('请先选择 assistant');
      return;
    }
    setRunning(true);
    try {
      const input = parseJsonObject(runInputText);
      const command = parseJsonObject(runCommandText);
      const metadata = buildMetadataForRun(withGraphDraft);
      const interruptBefore = parseInterruptSetting(interruptBeforeText);
      const interruptAfter = parseInterruptSetting(interruptAfterText);
      const payload: StudioRunWaitRequest = {
        assistant_id: assistantId,
        input,
        metadata,
        on_completion: 'keep',
      };
      if (Object.keys(command).length > 0) payload.command = command;
      if (interruptBefore) payload.interrupt_before = interruptBefore;
      if (interruptAfter) payload.interrupt_after = interruptAfter;
      setLastRunRequest(payload);
      const headers = parseJsonObject(langgraphHeadersText) as Record<
        string,
        string
      >;
      const result =
        statefulThreadMode && selectedThreadId
          ? await runWaitOnThreadDirectLanggraph(selectedThreadId, payload, {
              baseUrl: langgraphBaseUrl,
              timeoutMs: Number(langgraphTimeoutMs || 60000),
              headers,
            })
          : await runWaitDirectLanggraph(payload, {
              baseUrl: langgraphBaseUrl,
              path: langgraphPath,
              timeoutMs: Number(langgraphTimeoutMs || 60000),
              headers,
            });
      setLastRunResponse(result);
      const record = addRunRecord(payload, result);
      const responseRecord = result as Record<string, unknown>;
      const maybeThreadId = pickOptionalString(responseRecord, [
        'thread_id',
        'threadId',
        'conversation_id',
      ]);
      if (maybeThreadId) {
        const target = threads.find((thread) => {
          const record = thread as Record<string, unknown>;
          return (
            String(record.thread_id ?? record.id ?? '') ===
            String(maybeThreadId)
          );
        });
        if (target) setSelectedThread(target);
      }
      setSelectedRunId(record.id);
      message.success(
        withGraphDraft
          ? 'run/wait 执行完成（已携带 graph_draft）'
          : 'run/wait 执行完成'
      );
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'run/wait 执行失败'
      );
    } finally {
      setRunning(false);
    }
  }, [
    buildMetadataForRun,
    message,
    langgraphAssistantId,
    langgraphBaseUrl,
    langgraphHeadersText,
    langgraphPath,
    langgraphTimeoutMs,
    interruptAfterText,
    interruptBeforeText,
    runCommandText,
    runInputText,
    selectedThreadId,
    selectedAssistantId,
    statefulThreadMode,
    addRunRecord,
    setSelectedRunId,
    threads,
    setLastRunRequest,
    setLastRunResponse,
  ]);

  const handleResumeRun = useCallback(async () => {
    if (!runCommandText.trim() || runCommandText.trim() === '{}') {
      message.warning('请先填写 command（例如 {"resume": {...}}）');
      return;
    }
    if (!statefulThreadMode || !selectedThreadId) {
      message.warning('仅 thread 模式且已选择 thread 时允许恢复执行');
      return;
    }
    if (!canResumeByStatus) {
      message.warning(
        `当前 run 状态为 ${runStatus || 'unknown'}，仅 interrupted/paused 可恢复`
      );
      return;
    }
    let command: Record<string, unknown>;
    try {
      command = parseJsonObject(runCommandText);
    } catch {
      message.warning('command 必须是合法 JSON 对象');
      return;
    }
    if (!Object.hasOwn(command, 'resume')) {
      message.warning('恢复执行请传 command.resume，例如 {"resume": {...}}');
      return;
    }
    const assistantId = (selectedAssistantId ?? langgraphAssistantId).trim();
    if (!assistantId) {
      message.warning('请先选择 assistant');
      return;
    }
    setRunning(true);
    try {
      const metadata = parseJsonObject(runMetadataText);
      const headers = parseJsonObject(langgraphHeadersText) as Record<
        string,
        string
      >;
      const payload: StudioRunWaitRequest = {
        assistant_id: assistantId,
        input: {},
        metadata,
        command,
        on_completion: 'keep',
      };
      setLastRunRequest(payload);
      const result =
        statefulThreadMode && selectedThreadId
          ? await runWaitOnThreadDirectLanggraph(selectedThreadId, payload, {
              baseUrl: langgraphBaseUrl,
              timeoutMs: Number(langgraphTimeoutMs || 60000),
              headers,
            })
          : await runWaitDirectLanggraph(payload, {
              baseUrl: langgraphBaseUrl,
              path: langgraphPath,
              timeoutMs: Number(langgraphTimeoutMs || 60000),
              headers,
            });
      setLastRunResponse(result);
      const record = addRunRecord(payload, result);
      setSelectedRunId(record.id);
      message.success('已提交 command 恢复执行');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '恢复执行失败');
    } finally {
      setRunning(false);
    }
  }, [
    addRunRecord,
    langgraphAssistantId,
    langgraphBaseUrl,
    langgraphHeadersText,
    langgraphPath,
    langgraphTimeoutMs,
    message,
    runCommandText,
    runMetadataText,
    runStatus,
    selectedAssistantId,
    selectedThreadId,
    setLastRunRequest,
    setLastRunResponse,
    setSelectedRunId,
    statefulThreadMode,
    canResumeByStatus,
  ]);

  const reloadThreads = useCallback(async () => {
    const payload = parseJsonObject(threadsQueryText);
    const list = await searchThreads(payload);
    setThreads(list);
    return list;
  }, [setThreads, threadsQueryText]);

  const handleCreateThread = useCallback(async () => {
    setCreatingThread(true);
    try {
      const payload = parseJsonObject(threadCreateText);
      const headers = parseJsonObject(langgraphHeadersText) as Record<
        string,
        string
      >;
      const created = await createThreadDirectLanggraph(payload, {
        baseUrl: langgraphBaseUrl,
        timeoutMs: Number(langgraphTimeoutMs || 60000),
        headers,
      });
      await reloadThreads();
      setSelectedThread(created);
      message.success('thread 创建成功');
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : '创建 thread 失败'
      );
    } finally {
      setCreatingThread(false);
    }
  }, [
    langgraphBaseUrl,
    langgraphHeadersText,
    langgraphTimeoutMs,
    message,
    reloadThreads,
    threadCreateText,
  ]);

  const handleForkThread = useCallback(async () => {
    if (!selectedThreadId) {
      message.warning('请先选择一个 thread');
      return;
    }
    setForkingThread(true);
    try {
      const headers = parseJsonObject(langgraphHeadersText) as Record<
        string,
        string
      >;
      const created = await copyThreadDirectLanggraph(selectedThreadId, {
        baseUrl: langgraphBaseUrl,
        timeoutMs: Number(langgraphTimeoutMs || 60000),
        headers,
      });
      await reloadThreads();
      setSelectedThread(created);
      message.success('thread fork 成功');
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'thread fork 失败'
      );
    } finally {
      setForkingThread(false);
    }
  }, [
    langgraphBaseUrl,
    langgraphHeadersText,
    langgraphTimeoutMs,
    message,
    reloadThreads,
    selectedThreadId,
  ]);

  const handleSearchThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const list = await reloadThreads();
      message.success(`已加载 ${list.length} 条 threads`);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : '查询 threads 失败'
      );
    } finally {
      setLoadingThreads(false);
    }
  }, [message, reloadThreads]);

  const handleLoadThreadState = useCallback(async () => {
    if (!selectedThreadId) {
      message.warning('请先选择一个 thread');
      return;
    }
    setLoadingThreadState(true);
    try {
      const headers = parseJsonObject(langgraphHeadersText) as Record<
        string,
        string
      >;
      const data = await getThreadStateDirectLanggraph(selectedThreadId, {
        baseUrl: langgraphBaseUrl,
        timeoutMs: Number(langgraphTimeoutMs || 60000),
        headers,
        subgraphs: false,
      });
      setThreadStateText(JSON.stringify(data, null, 2));
      message.success('已加载 thread state');
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : '加载 thread state 失败'
      );
    } finally {
      setLoadingThreadState(false);
    }
  }, [
    langgraphBaseUrl,
    langgraphHeadersText,
    langgraphTimeoutMs,
    message,
    selectedThreadId,
  ]);

  const handleUpdateThreadState = useCallback(async () => {
    if (!selectedThreadId) {
      message.warning('请先选择一个 thread');
      return;
    }
    setUpdatingThreadState(true);
    try {
      const payload = parseJsonObject(threadStateUpdateText);
      const headers = parseJsonObject(langgraphHeadersText) as Record<
        string,
        string
      >;
      const data = await updateThreadStateDirectLanggraph(
        selectedThreadId,
        payload,
        {
          baseUrl: langgraphBaseUrl,
          timeoutMs: Number(langgraphTimeoutMs || 60000),
          headers,
        }
      );
      message.success('thread state 更新成功');
      setThreadStateText(JSON.stringify(data, null, 2));
      await handleLoadThreadState();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : '更新 thread state 失败'
      );
    } finally {
      setUpdatingThreadState(false);
    }
  }, [
    handleLoadThreadState,
    langgraphBaseUrl,
    langgraphHeadersText,
    langgraphTimeoutMs,
    message,
    selectedThreadId,
    threadStateUpdateText,
  ]);

  useEffect(() => {
    void loadStudioInfo();
    void loadAssistants();
  }, [loadAssistants, loadStudioInfo]);

  return (
    <PageContainer
      title='AI Planner Console'
      subTitle='辅助能力：LangGraph 规划与调试（非运行时主链路）'
      extra={[
        <Button key='info' loading={loadingInfo} onClick={loadStudioInfo}>
          刷新 Studio Info
        </Button>,
        <Button key='assistants' onClick={loadAssistants}>
          刷新 Assistants
        </Button>,
        <Button
          key='create-assistant'
          type='primary'
          loading={creatingAssistant}
          onClick={handleCreateAssistant}
        >
          创建 Assistant
        </Button>,
        <Button
          key='threads'
          loading={loadingThreads}
          onClick={handleSearchThreads}
        >
          刷新 Threads
        </Button>,
      ]}
    >
      <div className='grid grid-cols-12 gap-4'>
        <div className='col-span-3 flex flex-col gap-4'>
          <Card title='Assistants 导航' size='small'>
            <Space direction='vertical' className='w-full'>
              <TextArea
                rows={3}
                value={assistantsQueryText}
                onChange={(e) => setAssistantsQueryText(e.target.value)}
                placeholder='assistants/search 请求 JSON'
              />
              <TextArea
                rows={4}
                value={assistantCreateText}
                onChange={(e) => setAssistantCreateText(e.target.value)}
                placeholder='assistants/create 请求 JSON'
              />
              <Button
                type='primary'
                loading={creatingAssistant}
                onClick={handleCreateAssistant}
              >
                新建 assistant
              </Button>
              <List
                size='small'
                bordered
                dataSource={assistants}
                locale={{ emptyText: '暂无 assistants' }}
                renderItem={(assistant) => {
                  const active = assistant.assistant_id === selectedAssistantId;
                  return (
                    <List.Item
                      className={active ? 'bg-blue-50' : ''}
                      actions={[
                        <Button
                          key='pick'
                          type={active ? 'primary' : 'link'}
                          size='small'
                          onClick={() =>
                            setSelectedAssistantId(assistant.assistant_id)
                          }
                        >
                          {active ? '已选中' : '选择'}
                        </Button>,
                      ]}
                    >
                      <div className='min-w-0'>
                        <div className='truncate text-sm font-medium'>
                          {assistant.name || assistant.assistant_id}
                        </div>
                        <div className='truncate text-xs text-neutral-500'>
                          {assistant.assistant_id}
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            </Space>
          </Card>

          <Card title='Threads 导航' size='small'>
            <Space direction='vertical' className='w-full'>
              <TextArea
                rows={3}
                value={threadsQueryText}
                onChange={(e) => setThreadsQueryText(e.target.value)}
                placeholder='threads/search 请求 JSON'
              />
              <TextArea
                rows={3}
                value={threadCreateText}
                onChange={(e) => setThreadCreateText(e.target.value)}
                placeholder='threads/create 请求 JSON'
              />
              <Space>
                <Button
                  type='primary'
                  loading={creatingThread}
                  onClick={handleCreateThread}
                >
                  新建 thread
                </Button>
                <Button
                  loading={forkingThread}
                  onClick={handleForkThread}
                  disabled={!selectedThreadId}
                >
                  fork 选中 thread
                </Button>
              </Space>
              <Table
                rowKey={(record) =>
                  String(
                    record.thread_id ??
                      record.id ??
                      JSON.stringify(record).slice(0, 30)
                  )
                }
                size='small'
                pagination={{ pageSize: 5 }}
                dataSource={threads}
                columns={[
                  {
                    title: 'thread_id',
                    dataIndex: 'thread_id',
                    key: 'thread_id',
                    width: 180,
                    render: (_, row) =>
                      String(
                        (row as Record<string, unknown>).thread_id ??
                          row.id ??
                          '-'
                      ),
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 90,
                    render: (_, row) => (
                      <Button
                        type='link'
                        size='small'
                        onClick={() => {
                          setSelectedThread(row as StudioThread);
                          const record = row as Record<string, unknown>;
                          const assistantId = pickOptionalString(record, [
                            'assistant_id',
                          ]);
                          if (assistantId) setSelectedAssistantId(assistantId);
                        }}
                      >
                        查看
                      </Button>
                    ),
                  },
                ]}
              />
            </Space>
          </Card>
        </div>

        <div className='col-span-6 flex flex-col gap-4'>
          <Card title='StudioRun 工作区' size='small'>
            <Form layout='vertical'>
              <Form.Item label='assistant_id'>
                <Input
                  value={selectedAssistantId || langgraphAssistantId}
                  disabled
                />
              </Form.Item>
              <Form.Item label='执行维度'>
                <Space>
                  <Button
                    size='small'
                    type={statefulThreadMode ? 'primary' : 'default'}
                    onClick={() => setStatefulThreadMode(true)}
                  >
                    thread
                  </Button>
                  <Button
                    size='small'
                    type={!statefulThreadMode ? 'primary' : 'default'}
                    onClick={() => setStatefulThreadMode(false)}
                  >
                    stateless
                  </Button>
                  <span className='text-xs text-neutral-500'>
                    {statefulThreadMode
                      ? selectedThreadId
                        ? `使用 /threads/${selectedThreadId}/runs/wait`
                        : '未选 thread，自动回退 /runs/wait'
                      : '使用 /runs/wait'}
                  </span>
                </Space>
              </Form.Item>
              <Form.Item label='input JSON'>
                <TextArea
                  rows={8}
                  value={runInputText}
                  onChange={(e) => setRunInputText(e.target.value)}
                />
              </Form.Item>
              <Form.Item label='interrupt_before'>
                <Input
                  value={interruptBeforeText}
                  onChange={(e) => setInterruptBeforeText(e.target.value)}
                  placeholder='支持 * 或 ["node_a","node_b"] 或 node_a,node_b'
                />
              </Form.Item>
              <Form.Item label='interrupt_after'>
                <Input
                  value={interruptAfterText}
                  onChange={(e) => setInterruptAfterText(e.target.value)}
                  placeholder='支持 * 或 ["node_a","node_b"] 或 node_a,node_b'
                />
              </Form.Item>
              <Form.Item label='command(JSON)'>
                <TextArea
                  rows={4}
                  value={runCommandText}
                  onChange={(e) => setRunCommandText(e.target.value)}
                  placeholder='例如 {"resume":{"approved":true}}'
                />
              </Form.Item>
              <Form.Item label='metadata JSON'>
                <TextArea
                  rows={4}
                  value={runMetadataText}
                  onChange={(e) => setRunMetadataText(e.target.value)}
                />
              </Form.Item>
              <div className='overflow-x-auto pb-1'>
                <div className='inline-flex min-w-max gap-2'>
                  <Button
                    type='primary'
                    loading={running}
                    onClick={() => void handleRunWait(false)}
                  >
                    run/wait
                  </Button>
                  <Button
                    loading={running}
                    onClick={() => void handleRunWait(true)}
                  >
                    注入画布并运行
                  </Button>
                  <Button onClick={loadAssistants}>刷新 assistants</Button>
                  <Button
                    loading={loadingThreads}
                    onClick={handleSearchThreads}
                  >
                    刷新 threads
                  </Button>
                  <Button
                    onClick={() => {
                      try {
                        const current = parseJsonObject(runMetadataText);
                        const next = {
                          ...current,
                          graph_draft: graphDraft,
                        };
                        setRunMetadataText(JSON.stringify(next, null, 2));
                        message.success(
                          '已将画布编排注入 metadata.graph_draft'
                        );
                      } catch {
                        message.error('metadata 不是合法 JSON，无法注入画布');
                      }
                    }}
                  >
                    注入画布到 metadata
                  </Button>
                  <Button
                    onClick={() => {
                      applyGraphFromResponse(
                        inspectorResponseRecord,
                        '当前 run'
                      );
                    }}
                  >
                    从当前 run 生成画布
                  </Button>
                  <Button
                    loading={running}
                    disabled={!canResumeByStatus || !selectedThreadId}
                    onClick={handleResumeRun}
                  >
                    恢复执行(command.resume)
                  </Button>
                </div>
              </div>
            </Form>
          </Card>

          <Card title='运行结果面板' size='small'>
            <pre className='max-h-80 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
              {lastRunResponse
                ? JSON.stringify(lastRunResponse, null, 2)
                : '暂无'}
            </pre>
          </Card>

          <Card title='Run History（本地）' size='small'>
            <Table
              size='small'
              rowKey='id'
              pagination={{ pageSize: 6 }}
              dataSource={runHistory}
              rowClassName={(record) =>
                record.id === selectedRunId ? 'bg-blue-50' : ''
              }
              columns={[
                {
                  title: 'run_id',
                  dataIndex: 'id',
                  key: 'id',
                  width: 180,
                },
                {
                  title: 'assistant',
                  dataIndex: 'assistantId',
                  key: 'assistantId',
                  width: 180,
                },
                {
                  title: 'time',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  width: 190,
                  render: (value) => String(value ?? '-'),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 180,
                  render: (_, row) => (
                    <Space size='small'>
                      <Button
                        type='link'
                        size='small'
                        onClick={() => {
                          setSelectedRunId(row.id);
                          setLastRunRequest(row.request);
                          setLastRunResponse(row.response);
                        }}
                      >
                        检视
                      </Button>
                      <Button
                        type='link'
                        size='small'
                        onClick={() =>
                          applyGraphFromResponse(
                            row.response as Record<string, unknown>,
                            `run ${row.id}`
                          )
                        }
                      >
                        生成画布
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </div>

        <div className='col-span-3 flex flex-col gap-4'>
          <Card title='RunInspector' size='small'>
            <Space direction='vertical' className='w-full'>
              <div className='flex flex-wrap gap-2'>
                <Tag color={runStatus === 'error' ? 'error' : 'blue'}>
                  status: {runStatus}
                </Tag>
                <Tag>started: {runStartedAt}</Tag>
                <Tag>finished: {runFinishedAt}</Tag>
                <Tag color={runUsesGraphDraft ? 'gold' : 'default'}>
                  graph_draft: {runUsesGraphDraft ? 'on' : 'off'}
                </Tag>
              </div>
              <Divider className='my-2' />
              <div className='text-xs text-neutral-600'>selected run id</div>
              <Tag color='cyan'>{selectedRun?.id ?? '-'}</Tag>
              <div className='flex flex-wrap gap-2'>
                <Tag>latency_ms: {runLatencyMs ?? '-'}</Tag>
                <Tag>prompt_tokens: {promptTokens ?? '-'}</Tag>
                <Tag>completion_tokens: {completionTokens ?? '-'}</Tag>
                <Tag>total_tokens: {totalTokens ?? '-'}</Tag>
              </div>
              <Divider className='my-2' />
              <div className='text-xs text-neutral-600'>error / message</div>
              <pre className='max-h-24 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
                {runError}
              </pre>
              <div className='text-xs text-neutral-600'>lastRunRequest</div>
              <pre className='max-h-36 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
                {lastRunRequest
                  ? JSON.stringify(lastRunRequest, null, 2)
                  : '暂无'}
              </pre>
              <div className='text-xs text-neutral-600'>inspector response</div>
              <pre className='max-h-36 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
                {Object.keys(inspectorResponseRecord).length
                  ? JSON.stringify(inspectorResponseRecord, null, 2)
                  : '暂无'}
              </pre>
              <div className='text-xs text-neutral-600'>run step timeline</div>
              {runSteps.length ? (
                <List
                  size='small'
                  bordered
                  dataSource={runSteps}
                  renderItem={(step, index) => {
                    const stepStatus = pickStringField(step, [
                      'status',
                      'state',
                    ]);
                    const stepNode = pickStringField(step, [
                      'node_id',
                      'node',
                      'name',
                    ]);
                    const stepStarted = pickStringField(step, [
                      'started_at',
                      'start_time',
                    ]);
                    const stepFinished = pickStringField(step, [
                      'finished_at',
                      'end_time',
                    ]);
                    return (
                      <List.Item>
                        <div className='w-full'>
                          <div className='flex flex-wrap gap-2'>
                            <Tag color='default'>#{index + 1}</Tag>
                            <Tag>{stepNode}</Tag>
                            <Tag
                              color={stepStatus === 'error' ? 'error' : 'blue'}
                            >
                              {stepStatus}
                            </Tag>
                          </div>
                          <div className='mt-1 text-xs text-neutral-500'>
                            {`${stepStarted} -> ${stepFinished}`}
                          </div>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Tag>当前 run 暂无 steps/trace</Tag>
              )}
            </Space>
          </Card>

          <Card title='Selected Assistant' size='small'>
            {selectedAssistant ? (
              <pre className='max-h-56 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
                {JSON.stringify(selectedAssistant, null, 2)}
              </pre>
            ) : (
              <Tag>未选择 assistant</Tag>
            )}
          </Card>

          <Card title='Selected Thread' size='small'>
            <pre className='max-h-56 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
              {selectedThread
                ? JSON.stringify(selectedThread, null, 2)
                : '暂无'}
            </pre>
          </Card>
          <Card title='State Inspector' size='small'>
            <Space direction='vertical' className='w-full'>
              <Space>
                <Button
                  loading={loadingThreadState}
                  onClick={handleLoadThreadState}
                  disabled={!selectedThreadId}
                >
                  加载 state
                </Button>
                <Button
                  type='primary'
                  loading={updatingThreadState}
                  onClick={handleUpdateThreadState}
                  disabled={!selectedThreadId}
                >
                  提交 state update
                </Button>
              </Space>
              <div className='text-xs text-neutral-600'>thread state</div>
              <TextArea
                rows={8}
                value={threadStateText}
                onChange={(e) => setThreadStateText(e.target.value)}
              />
              <div className='text-xs text-neutral-600'>
                state update payload
              </div>
              <TextArea
                rows={6}
                value={threadStateUpdateText}
                onChange={(e) => setThreadStateUpdateText(e.target.value)}
              />
            </Space>
          </Card>
          <Card title='Thread Timeline' size='small'>
            {selectedThreadTimeline.length ? (
              <List
                size='small'
                bordered
                dataSource={selectedThreadTimeline}
                renderItem={(item, index) => {
                  const runId = pickStringField(item, ['run_id', 'id']);
                  const status = pickStringField(item, ['status', 'state']);
                  const started = pickStringField(item, [
                    'started_at',
                    'start_time',
                  ]);
                  const finished = pickStringField(item, [
                    'finished_at',
                    'end_time',
                  ]);
                  return (
                    <List.Item>
                      <div className='w-full'>
                        <div className='flex flex-wrap gap-2'>
                          <Tag>#{index + 1}</Tag>
                          <Tag color='cyan'>{runId}</Tag>
                          <Tag color={status === 'error' ? 'error' : 'blue'}>
                            {status}
                          </Tag>
                          <Button
                            type='link'
                            size='small'
                            onClick={() =>
                              applyGraphFromResponse(
                                item,
                                `thread timeline #${index + 1}`
                              )
                            }
                          >
                            生成画布
                          </Button>
                        </div>
                        <div className='mt-1 text-xs text-neutral-500'>
                          {`${started} -> ${finished}`}
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            ) : (
              <Tag>当前 thread 未包含可解析 runs/history</Tag>
            )}
          </Card>
        </div>
      </div>

      <Card title='Studio Info' size='small' className='mt-4'>
        <pre className='max-h-56 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
          {studioInfo ? JSON.stringify(studioInfo, null, 2) : '暂无'}
        </pre>
      </Card>
      <div className='mt-4'>
        <StudioGraphPlayground
          onGraphChange={setGraphDraft}
          seedGraph={graphSeed}
          applySeedToken={graphApplyToken}
        />
      </div>
    </PageContainer>
  );
};

export default StudioPage;
