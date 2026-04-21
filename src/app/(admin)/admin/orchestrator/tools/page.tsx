'use client';

import { PageContainer } from '@ant-design/pro-components';
import { Button, message, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';

import { listTools, refreshTools } from '@/api/tools';
import { extractToolsList } from '@/lib/orchestrator';
import type { RegisteredTool } from '@/types/orchestrator';

type ToolRow = RegisteredTool & { _tableRowKey: string };

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

function extractOutputSchema(tool: ToolRow): unknown {
  const candidates = [
    tool.outputSchema,
    tool.output_schema,
    tool.responseSchema,
    tool.response_schema,
    tool.resultSchema,
    tool.result_schema,
    tool.schema && typeof tool.schema === 'object'
      ? (tool.schema as Record<string, unknown>).output
      : undefined,
  ];
  return candidates.find((v) => v !== undefined && v !== null);
}

function withStableRowKeys(list: RegisteredTool[]): ToolRow[] {
  return list.map((r, index) => {
    const primary = r.toolId ?? r.id;
    if (primary != null && String(primary) !== '') {
      return { ...r, _tableRowKey: String(primary) };
    }
    return {
      ...r,
      _tableRowKey: `tool-${index}-${[r.name, r.source, r.description].filter(Boolean).join('\u0001')}`,
    };
  });
}

const ToolsPage = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ToolRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await listTools();
      setData(
        withStableRowKeys(extractToolsList(raw))
      );
    } catch {
      /* request */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTools();
      message.success('已触发刷新');
      await load();
    } catch {
      /* */
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const columns: ColumnsType<ToolRow> = [
    {
      title: 'ID',
      dataIndex: 'id',
      render: (_, row) => String(row.toolId ?? row.id ?? '—'),
      ellipsis: true,
      width: 280,
    },
    {
      title: '展示名',
      dataIndex: 'displayName',
      ellipsis: true,
      render: (_, row) => String(row.displayName ?? row.name ?? '—'),
    },
    {
      title: '名称',
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      title: '服务',
      dataIndex: 'server',
      ellipsis: true,
      width: 160,
    },
    {
      title: '来源',
      dataIndex: 'source',
      render: (v) => (v != null ? <Tag>{String(v)}</Tag> : '—'),
      width: 100,
    },
    {
      title: '发现时间',
      dataIndex: 'discoveredAt',
      ellipsis: true,
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: 'inputSchema',
      dataIndex: 'inputSchema',
      width: 280,
      render: (_, row) => {
        if (!row.inputSchema) return '—';
        const text =
          typeof row.inputSchema === 'string'
            ? row.inputSchema
            : JSON.stringify(row.inputSchema, null, 2);
        return (
          <pre className="max-h-28 overflow-auto rounded bg-neutral-50 p-2 text-xs">
            {text}
          </pre>
        );
      },
    },
    {
      title: 'bodySchema',
      dataIndex: 'inputSchema',
      width: 280,
      render: (_, row) => {
        const bodySchema = extractBodySchema(row.inputSchema);
        if (!bodySchema) return '—';
        const text =
          typeof bodySchema === 'string' ? bodySchema : JSON.stringify(bodySchema, null, 2);
        return (
          <pre className="max-h-28 overflow-auto rounded bg-neutral-50 p-2 text-xs">
            {text}
          </pre>
        );
      },
    },
    {
      title: 'outputSchema',
      dataIndex: 'outputSchema',
      width: 280,
      render: (_, row) => {
        const schema = extractOutputSchema(row);
        if (!schema) return '未提供 output schema';
        const text = typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);
        return (
          <pre className="max-h-28 overflow-auto rounded bg-neutral-50 p-2 text-xs">
            {text}
          </pre>
        );
      },
    },
  ];

  return (
    <PageContainer
      title="工具注册"
      extra={[
        <Button key="reload" onClick={load} loading={loading}>
          重新加载
        </Button>,
        <Button key="refresh" type="primary" loading={refreshing} onClick={handleRefresh}>
          刷新 MCP 工具
        </Button>,
      ]}
    >
      <Table<ToolRow>
        rowKey="_tableRowKey"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={{ pageSize: 20 }}
        scroll={{ x: true }}
      />
    </PageContainer>
  );
};

export default ToolsPage;
