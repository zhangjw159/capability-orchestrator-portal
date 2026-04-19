'use client';

import { PageContainer } from '@ant-design/pro-components';
import { Button, message, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';

import { listTools, refreshTools } from '@/api/tools';
import { extractToolsList } from '@/lib/orchestrator';
import type { RegisteredTool } from '@/types/orchestrator';

type ToolRow = RegisteredTool & { _tableRowKey: string };

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
