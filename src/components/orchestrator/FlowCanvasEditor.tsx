'use client';

import { App, Button, Card, Collapse, Form, Input, Select, Space, Tag } from 'antd';
import TextArea from 'antd/es/input/TextArea';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';

import { executeFlow, saveDefinition, validateFlow } from '@/api/orchestrator';
import type { Flow, FlowNodeType, OrchestratorSkill, ValidationIssue } from '@/types/orchestrator';

const NODE_TYPES: FlowNodeType[] = [
  'start',
  'end',
  'set',
  'template',
  'condition',
  'tool',
  'confirm',
  'model',
];

type Props = {
  definitionId?: string;
  initialFlow: Flow;
  skills: OrchestratorSkill[];
  readonlyFlowId?: boolean;
  onSaved?: () => void;
};

function toCanvas(flow: Flow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (flow.nodes ?? []).map((node, index) => ({
    id: node.id,
    position: { x: 120 + (index % 4) * 220, y: 80 + Math.floor(index / 4) * 120 },
    data: { label: node.name || `${node.type}:${node.id}` },
    style: { borderRadius: 8, border: '1px solid #d9d9d9', padding: 6, width: 180 },
  }));
  const edges: Edge[] = (flow.edges ?? []).map((edge) => ({
    id: edge.id || uuidv4(),
    source: edge.source,
    target: edge.target,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
  return { nodes, edges };
}

function toFlow(base: Flow, nodes: Node[], edges: Edge[]): Flow {
  const nodeMap = new Map(base.nodes.map((node) => [node.id, node]));
  return {
    ...base,
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
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

const FlowCanvasEditor = ({ definitionId, initialFlow, skills, readonlyFlowId, onSaved }: Props) => {
  const { message } = App.useApp();
  const router = useRouter();
  const [flowDraft, setFlowDraft] = useState<Flow>(initialFlow);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [validateIssues, setValidateIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [inputText, setInputText] = useState('{}');
  const [executeResult, setExecuteResult] = useState<unknown>(null);

  useEffect(() => {
    const mapped = toCanvas(initialFlow);
    setFlowDraft(initialFlow);
    setNodes(mapped.nodes);
    setEdges(mapped.edges);
  }, [initialFlow]);

  useEffect(() => {
    setFlowDraft((prev) => toFlow(prev, nodes, edges));
  }, [nodes, edges]);

  const selectedNode = useMemo(
    () => flowDraft.nodes.find((node) => node.id === selectedNodeId),
    [flowDraft.nodes, selectedNodeId]
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);
  const onConnect = useCallback((connection: Edge | Connection) => {
    setEdges((current) =>
      addEdge({ ...connection, id: uuidv4(), markerEnd: { type: MarkerType.ArrowClosed } }, current)
    );
  }, []);

  const handleAddNode = useCallback(
    (type: FlowNodeType) => {
      const id = `${type}-${Math.random().toString(36).slice(2, 8)}`;
      const nextNode: Node = {
        id,
        position: { x: 120 + (nodes.length % 4) * 220, y: 80 + Math.floor(nodes.length / 4) * 120 },
        data: { label: `${type}-${id}` },
        style: { borderRadius: 8, border: '1px solid #d9d9d9', padding: 6, width: 180 },
      };
      setNodes((current) => [...current, nextNode]);
      setFlowDraft((prev) => ({
        ...prev,
        nodes: [...prev.nodes, { id, type, name: `${type}-${id}`, config: {} }],
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
        nodes: prev.nodes.map((node) => (node.id === selectedNodeId ? { ...node, ...patch } : node)),
      }));
      if (patch.name) {
        setNodes((current) =>
          current.map((node) =>
            node.id === selectedNodeId ? { ...node, data: { ...node.data, label: patch.name } } : node
          )
        );
      }
    },
    [selectedNodeId]
  );

  const runValidate = useCallback(async () => {
    const res = await validateFlow(flowDraft);
    const issues = [...(res.errorIssues ?? []), ...(res.warningIssues ?? [])];
    setValidateIssues(issues);
    if (res.valid === false) {
      message.error(res.message || '校验未通过');
    } else {
      message.success('校验通过');
    }
    return res;
  }, [flowDraft, message]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const validation = await runValidate();
      if (validation.valid === false) return;
      await saveDefinition({
        definitionId,
        id: definitionId,
        name: flowDraft.name,
        flowId: flowDraft.id,
        dsl: flowDraft,
      });
      message.success('保存成功');
      onSaved?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [definitionId, flowDraft, message, onSaved, router, runValidate]);

  const handleValidateAndExecute = useCallback(async () => {
    setExecuting(true);
    try {
      const validation = await runValidate();
      if (validation.valid === false) return;
      const input = JSON.parse(inputText) as Record<string, unknown>;
      const result = definitionId
        ? await executeFlow({ flowDefinitionId: definitionId, input })
        : await executeFlow({ flow: flowDraft, input });
      setExecuteResult(result);
      message.success('执行完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '执行失败');
    } finally {
      setExecuting(false);
    }
  }, [definitionId, flowDraft, inputText, message, runValidate]);

  const issueNodeIdSet = useMemo(
    () => new Set(validateIssues.map((issue) => issue.nodeId).filter(Boolean)),
    [validateIssues]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-2" title="节点库" size="small">
          <Space direction="vertical" className="w-full">
            {NODE_TYPES.map((type) => (
              <Button key={type} block onClick={() => handleAddNode(type)}>
                {type}
              </Button>
            ))}
          </Space>
        </Card>
        <Card className="col-span-7" title="Flow 画布" size="small">
          <div className="h-[560px]">
            <ReactFlow
              nodes={nodes.map((node) =>
                issueNodeIdSet.has(node.id)
                  ? { ...node, style: { ...node.style, border: '1px solid #ff4d4f' } }
                  : node
              )}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              fitView
            >
              <MiniMap />
              <Controls />
              <Background />
            </ReactFlow>
          </div>
        </Card>
        <Card className="col-span-3" title="节点属性" size="small">
          {selectedNode ? (
            <Form layout="vertical">
              <Form.Item label="节点 ID">
                <Input value={selectedNode.id} disabled />
              </Form.Item>
              <Form.Item label="节点类型">
                <Select
                  value={selectedNode.type}
                  options={NODE_TYPES.map((type) => ({ value: type, label: type }))}
                  onChange={(value) => updateNode({ type: value })}
                />
              </Form.Item>
              <Form.Item label="节点名称">
                <Input value={selectedNode.name} onChange={(e) => updateNode({ name: e.target.value })} />
              </Form.Item>
              {selectedNode.type === 'tool' ? (
                <>
                  <Form.Item label="tool.mode">
                    <Select
                      value={String((selectedNode.config?.mode as string) ?? 'skill')}
                      options={[
                        { value: 'skill', label: 'skill' },
                        { value: 'tool', label: 'tool' },
                      ]}
                      onChange={(value) => {
                        const nextConfig = { ...(selectedNode.config ?? {}), mode: value };
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
                  {String((selectedNode.config?.mode as string) ?? 'skill') === 'skill' ? (
                    <Form.Item label="config.skill">
                      <Select
                        value={String((selectedNode.config?.skill as string) ?? '')}
                        options={skills.map((skill) => ({ value: skill.skillId, label: skill.skillId }))}
                        onChange={(value) =>
                          updateNode({ config: { ...(selectedNode.config ?? {}), skill: value } })
                        }
                      />
                    </Form.Item>
                  ) : (
                    <>
                      <Form.Item label="toolId">
                        <Input
                          value={String((selectedNode.config?.toolId as string) ?? '')}
                          onChange={(e) =>
                            updateNode({
                              config: { ...(selectedNode.config ?? {}), toolId: e.target.value },
                            })
                          }
                        />
                      </Form.Item>
                      <Form.Item label="server">
                        <Input
                          value={String((selectedNode.config?.server as string) ?? '')}
                          onChange={(e) =>
                            updateNode({
                              config: { ...(selectedNode.config ?? {}), server: e.target.value },
                            })
                          }
                        />
                      </Form.Item>
                    </>
                  )}
                </>
              ) : null}
            </Form>
          ) : (
            <div className="text-neutral-500">请先选择一个节点</div>
          )}
        </Card>
      </div>

      <Collapse
        defaultActiveKey={['json', 'actions']}
        items={[
          {
            key: 'actions',
            label: '编辑动作',
            children: (
              <div className="flex flex-col gap-3">
                <Space wrap>
                  <Button onClick={runValidate}>校验</Button>
                  <Button type="primary" loading={saving} onClick={handleSave}>
                    保存草稿
                  </Button>
                  <Button type="primary" danger loading={executing} onClick={handleValidateAndExecute}>
                    校验并执行
                  </Button>
                </Space>
                <Input
                  addonBefore="flowId"
                  value={flowDraft.id}
                  disabled={readonlyFlowId}
                  onChange={(e) => setFlowDraft((prev) => ({ ...prev, id: e.target.value }))}
                />
                <Input
                  addonBefore="flowName"
                  value={flowDraft.name}
                  onChange={(e) => setFlowDraft((prev) => ({ ...prev, name: e.target.value }))}
                />
                <TextArea
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="执行 input JSON"
                />
                {validateIssues.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {validateIssues.map((issue) => (
                      <Tag
                        key={`${issue.nodeId ?? ''}-${issue.edgeId ?? ''}-${issue.code ?? ''}-${issue.message ?? ''}`}
                        color={issue.nodeId ? 'error' : 'warning'}
                      >
                        {issue.nodeId ? `节点 ${issue.nodeId}` : issue.edgeId ? `边 ${issue.edgeId}` : '全局'}:
                        {issue.message}
                      </Tag>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            key: 'json',
            label: 'DSL JSON 预览',
            children: (
              <pre className="max-h-80 overflow-auto rounded bg-neutral-50 p-3 text-xs">
                {JSON.stringify(flowDraft, null, 2)}
              </pre>
            ),
          },
          {
            key: 'result',
            label: '执行结果',
            children: (
              <pre className="max-h-80 overflow-auto rounded bg-neutral-50 p-3 text-xs">
                {executeResult ? JSON.stringify(executeResult, null, 2) : '暂无执行结果'}
              </pre>
            ),
          },
        ]}
      />
    </div>
  );
};

export default FlowCanvasEditor;
