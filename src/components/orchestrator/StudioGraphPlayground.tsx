'use client';

import { App, Button, Card, Form, Input, Space } from 'antd';
import TextArea from 'antd/es/input/TextArea';
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
  MiniMap,
  type Node,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';

type GraphNodeType = '__start__' | 'runnable' | '__end__';

type GraphPlaygroundProps = {
  onGraphChange?: (graph: Record<string, unknown>) => void;
  seedGraph?: Record<string, unknown> | null;
  applySeedToken?: number;
};

const NODE_TYPES: GraphNodeType[] = ['__start__', 'runnable', '__end__'];

function getNodeType(node: Node): string {
  return String((node.data as { nodeType?: string })?.nodeType ?? 'node');
}

function isBoundaryNode(node: Node | undefined): boolean {
  if (!node) return false;
  const type = getNodeType(node);
  return (
    type === '__start__' ||
    type === '__end__' ||
    node.id === '__start__' ||
    node.id === '__end__'
  );
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseJsonRecord(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON 需为对象');
  }
  return parsed as Record<string, unknown>;
}

function inferNodeType(
  rawType: string | undefined,
  rawName: string | undefined
): GraphNodeType {
  const type = String(rawType ?? '').toLowerCase().trim();
  const name = String(rawName ?? '').toLowerCase().trim();
  const prefix = name.split(':')[0];
  if (
    type === '__start__' ||
    type === 'start' ||
    prefix === '__start__' ||
    prefix === 'start'
  ) {
    return '__start__';
  }
  if (
    type === '__end__' ||
    type === 'end' ||
    prefix === '__end__' ||
    prefix === 'end'
  ) {
    return '__end__';
  }
  return 'runnable';
}

function normalizeEdgeLabel(label: unknown): string | undefined {
  const text = String(label ?? '').trim().toLowerCase();
  if (!text) return undefined;
  if (text === 'true' || text === 'false') return text;
  return String(label ?? '').trim();
}

function ensureBoundaryNodes(inputNodes: Node[]): Node[] {
  const withoutBoundaryDuplicates = inputNodes.filter((node) => {
    const type = getNodeType(node);
    return (
      !(type === '__start__' && node.id !== '__start__') &&
      !(type === '__end__' && node.id !== '__end__')
    );
  });
  const hasStart = withoutBoundaryDuplicates.some(
    (node) => node.id === '__start__'
  );
  const hasEnd = withoutBoundaryDuplicates.some((node) => node.id === '__end__');
  const nextNodes = [...withoutBoundaryDuplicates];
  if (!hasStart) {
    nextNodes.unshift({
      id: '__start__',
      position: { x: 40, y: 20 },
      data: { label: '__start__', nodeType: '__start__', status: 'success' },
      style: {
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        width: 180,
        padding: 8,
      },
    });
  }
  if (!hasEnd) {
    nextNodes.push({
      id: '__end__',
      position: { x: 260, y: 20 },
      data: { label: '__end__', nodeType: '__end__', status: 'success' },
      style: {
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        width: 180,
        padding: 8,
      },
    });
  }
  return nextNodes;
}

function ensureBoundaryEdges(inputNodes: Node[], inputEdges: Edge[]): Edge[] {
  const nodeIds = new Set(inputNodes.map((node) => node.id));
  return inputEdges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .filter((edge) => edge.source !== '__end__' && edge.target !== '__start__')
    .map((edge) => ({
      ...edge,
      label: normalizeEdgeLabel(edge.label),
    }));
}

function toGraphDsl(nodes: Node[], edges: Edge[]): Record<string, unknown> {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: getNodeType(node) === 'runnable' ? 'runnable' : getNodeType(node),
      data: {
        name:
          String((node.data as { name?: string })?.name ?? '').trim() ||
          `${getNodeType(node)}:${node.id}`,
        config: toRecord((node.data as { config?: unknown })?.config),
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === 'string' ? edge.label : undefined,
    })),
  };
}

type ParsedGraphInput = {
  nodes?: Array<{
    id?: string;
    type?: string;
    label?: string;
    name?: string;
    config?: Record<string, unknown>;
    status?: string;
    position?: { x?: number; y?: number };
  }>;
  edges?: Array<{
    id?: string;
    source?: string;
    target?: string;
    from?: string;
    to?: string;
    label?: string;
  }>;
};

function parseGraphInput(input: unknown): { nodes: Node[]; edges: Edge[] } {
  const parsed = (input ?? {}) as ParsedGraphInput;
  const nextNodes: Node[] = (parsed.nodes ?? []).map((node, index) => ({
    id: node.id ?? `n-${index}`,
    position: {
      x: node.position?.x ?? 100 + (index % 4) * 220,
      y: node.position?.y ?? 80 + Math.floor(index / 4) * 140,
    },
    data: {
      label: node.label ?? node.name ?? node.id ?? `node-${index}`,
      nodeType: inferNodeType(node.type, node.name),
      name:
        String(node.name ?? '').trim() ||
        `${inferNodeType(node.type, node.name)}:${node.id ?? `node-${index}`}`,
      config: toRecord(node.config),
      status: node.status ?? 'unknown',
    },
    style: {
      border:
        String(node.status ?? '').toLowerCase() === 'error'
          ? '1px solid #ff4d4f'
          : '1px solid #d9d9d9',
      borderRadius: 8,
      width: 180,
      padding: 8,
      background:
        String(node.status ?? '').toLowerCase() === 'error'
          ? '#fff2f0'
          : '#fff',
    },
  }));
  const nextEdges: Edge[] = (parsed.edges ?? []).map((edge, index) => ({
    id: edge.id ?? `e-${index}`,
    source: edge.source ?? edge.from ?? '',
    target: edge.target ?? edge.to ?? '',
    label: normalizeEdgeLabel(edge.label),
  }));
  const boundedNodes = ensureBoundaryNodes(nextNodes);
  const boundedEdges = ensureBoundaryEdges(boundedNodes, nextEdges);
  return { nodes: boundedNodes, edges: boundedEdges };
}

function validateGraph(_nodes: Node[], edges: Edge[]): string[] {
  const errors: string[] = [];
  const startIn = edges.filter((edge) => edge.target === '__start__').length;
  const endOut = edges.filter((edge) => edge.source === '__end__').length;
  if (startIn > 0) errors.push('__start__ 节点不能有入边');
  if (endOut > 0) errors.push('__end__ 节点不能有出边');
  return errors;
}

const StudioGraphPlayground = ({
  onGraphChange,
  seedGraph,
  applySeedToken,
}: GraphPlaygroundProps) => {
  const { message } = App.useApp();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [importText, setImportText] = useState('');

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId),
    [edges, selectedEdgeId]
  );
  const selectedNodeType = selectedNode ? getNodeType(selectedNode) : undefined;
  const boundaryNode = isBoundaryNode(selectedNode);
  const graphErrors = useMemo(() => validateGraph(nodes, edges), [edges, nodes]);

  const emitGraph = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onGraphChange?.(toGraphDsl(nextNodes, nextEdges));
    },
    [onGraphChange]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => {
        const applied = applyNodeChanges(changes, current);
        const nextNodes = ensureBoundaryNodes(applied);
        setEdges((currentEdges) => {
          const nextEdges = ensureBoundaryEdges(nextNodes, currentEdges);
          emitGraph(nextNodes, nextEdges);
          return nextEdges;
        });
        return nextNodes;
      });
    },
    [emitGraph]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) => {
        const next = ensureBoundaryEdges(
          nodes,
          applyEdgeChanges(changes, current)
        );
        emitGraph(nodes, next);
        return next;
      });
    },
    [emitGraph, nodes]
  );

  const onConnect = useCallback(
    (connection: Edge | Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === '__end__') {
        message.warning('__end__ 节点不能有出边');
        return;
      }
      if (connection.target === '__start__') {
        message.warning('__start__ 节点不能有入边');
        return;
      }
      setEdges((current) => {
        const next = ensureBoundaryEdges(
          nodes,
          addEdge({ ...connection, id: uuidv4() }, current)
        );
        emitGraph(nodes, next);
        return next;
      });
    },
    [emitGraph, message, nodes]
  );

  const handleAddNode = useCallback(
    (nodeType: GraphNodeType) => {
      const id = `${nodeType}-${Math.random().toString(36).slice(2, 8)}`;
      if (nodeType === '__start__' || nodeType === '__end__') {
        message.warning('__start__/__end__ 为保留边界节点，无需重复添加');
        return;
      }
      const nextNode: Node = {
        id,
        position: {
          x: 80 + (nodes.length % 4) * 220,
          y: 60 + Math.floor(nodes.length / 4) * 140,
        },
        data: {
          label: `${nodeType}:${id}`,
          nodeType,
          name: `${nodeType}:${id}`,
          config: {},
        },
        style: {
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          width: 180,
          padding: 8,
        },
      };
      const nextNodes = ensureBoundaryNodes([...nodes, nextNode]);
      setNodes(nextNodes);
      setSelectedNodeId(id);
      const nextEdges = ensureBoundaryEdges(nextNodes, edges);
      setEdges(nextEdges);
      emitGraph(nextNodes, nextEdges);
    },
    [edges, emitGraph, message, nodes]
  );

  const handleImport = useCallback(() => {
    if (!importText.trim()) return;
    try {
      const parsed = JSON.parse(importText) as ParsedGraphInput;
      const { nodes: nextNodes, edges: nextEdges } = parseGraphInput(parsed);
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedNodeId(undefined);
      setSelectedEdgeId(undefined);
      emitGraph(nextNodes, nextEdges);
    } catch {
      // ignore invalid import
    }
  }, [emitGraph, importText]);

  useEffect(() => {
    if (!seedGraph) return;
    void applySeedToken;
    const { nodes: nextNodes, edges: nextEdges } = parseGraphInput(seedGraph);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(undefined);
    setSelectedEdgeId(undefined);
    // 外部 seedGraph 只负责“灌入画布”，这里不要再回调 onGraphChange，
    // 否则会触发父组件 setState -> 子组件 effect -> 父组件 setState 的循环。
  }, [applySeedToken, seedGraph]);

  return (
    <Card title='Studio Graph Playground（实验）' size='small'>
      <div className='grid grid-cols-12 gap-3'>
        <Card title='节点库' size='small' className='col-span-2'>
          <Space direction='vertical' className='w-full'>
            {NODE_TYPES.map((nodeType) => (
              <Button
                key={nodeType}
                block
                onClick={() => handleAddNode(nodeType)}
              >
                {nodeType}
              </Button>
            ))}
          </Space>
        </Card>
        <Card title='画布' size='small' className='col-span-7'>
          <div className='h-[420px]'>
            <ReactFlow
              nodes={nodes}
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
          </div>
        </Card>
        <Card title='属性' size='small' className='col-span-3'>
          {selectedNode ? (
            <Form layout='vertical'>
              <Form.Item label='node.id'>
                <Input value={selectedNode.id} disabled />
              </Form.Item>
              <Form.Item label='node.type'>
                <Input value={selectedNodeType} disabled />
              </Form.Item>
              <Form.Item label='label'>
                <Input
                  value={String(
                    (selectedNode.data as { label?: string })?.label ?? ''
                  )}
                  disabled={boundaryNode}
                  onChange={(e) => {
                    const nextNodes = nodes.map((item) =>
                      item.id === selectedNode.id
                        ? {
                            ...item,
                            data: { ...item.data, label: e.target.value },
                          }
                        : item
                    );
                    setNodes(nextNodes);
                    emitGraph(nextNodes, edges);
                  }}
                />
              </Form.Item>
              <Form.Item label='name'>
                <Input
                  value={String((selectedNode.data as { name?: string })?.name ?? '')}
                  disabled={boundaryNode}
                  onChange={(e) => {
                    const nextNodes = nodes.map((item) =>
                      item.id === selectedNode.id
                        ? {
                            ...item,
                            data: { ...item.data, name: e.target.value },
                          }
                        : item
                    );
                    setNodes(nextNodes);
                    emitGraph(nextNodes, edges);
                  }}
                />
              </Form.Item>
              <Form.Item label='config(JSON)'>
                <TextArea
                  rows={8}
                  value={JSON.stringify(
                    toRecord((selectedNode.data as { config?: unknown })?.config),
                    null,
                    2
                  )}
                  disabled={boundaryNode}
                  onChange={(e) => {
                    try {
                      const config = parseJsonRecord(e.target.value);
                      const nextNodes = nodes.map((item) =>
                        item.id === selectedNode.id
                          ? {
                              ...item,
                              data: { ...item.data, config },
                            }
                          : item
                      );
                      setNodes(nextNodes);
                      emitGraph(nextNodes, edges);
                    } catch {
                      // ignore invalid JSON until user finishes editing
                    }
                  }}
                />
              </Form.Item>
              {boundaryNode ? (
                <div className='text-xs text-amber-600'>
                  __start__/__end__ 为边界保留节点，已设为只读。
                </div>
              ) : null}
            </Form>
          ) : selectedEdge ? (
            <Form layout='vertical'>
              <Form.Item label='edge.id'>
                <Input value={selectedEdge.id} disabled />
              </Form.Item>
              <Form.Item label='label'>
                <Input
                  value={
                    typeof selectedEdge.label === 'string'
                      ? selectedEdge.label
                      : ''
                  }
                  onChange={(e) => {
                    const nextEdges = edges.map((item) =>
                      item.id === selectedEdge.id
                        ? {
                            ...item,
                            label: e.target.value || undefined,
                          }
                        : item
                    );
                    setEdges(nextEdges);
                    emitGraph(nodes, nextEdges);
                  }}
                />
              </Form.Item>
            </Form>
          ) : (
            <div className='text-neutral-500'>请选择节点或边</div>
          )}
        </Card>
      </div>

      <div className='mt-3 grid grid-cols-12 gap-3'>
        <Card title='导入 JSON' size='small' className='col-span-6'>
          <TextArea
            rows={6}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='粘贴 graph json: { nodes: [], edges: [] }'
          />
          <div className='mt-2'>
            <Button onClick={handleImport}>导入到画布</Button>
          </div>
        </Card>
        <Card title='导出 JSON' size='small' className='col-span-6'>
          <pre className='max-h-44 overflow-auto rounded bg-neutral-50 p-3 text-xs'>
            {JSON.stringify(toGraphDsl(nodes, edges), null, 2)}
          </pre>
          {graphErrors.length ? (
            <div className='mt-2 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700'>
              {graphErrors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </div>
          ) : (
            <div className='mt-2 text-xs text-emerald-600'>结构校验通过</div>
          )}
        </Card>
      </div>
    </Card>
  );
};

export default StudioGraphPlayground;
