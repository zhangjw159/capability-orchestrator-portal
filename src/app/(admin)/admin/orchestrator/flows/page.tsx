'use client';

import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Button, Space, Tag } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { listDefinitions } from '@/api/orchestrator';
import { normalizeList } from '@/lib/orchestrator';
import type { FlowDefinitionSummary } from '@/types/orchestrator';

const FlowListPage = () => {
  const router = useRouter();

  const columns = useMemo<ProColumns<FlowDefinitionSummary>[]>(
    () => [
      {
        title: 'flowId',
        dataIndex: 'flowId',
        copyable: true,
        ellipsis: true,
      },
      {
        title: '名称',
        dataIndex: 'name',
        ellipsis: true,
        search: false,
      },
      {
        title: '版本',
        dataIndex: 'version',
        width: 100,
        search: false,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        search: false,
        render: (_, row) =>
          row.status != null ? <Tag>{String(row.status)}</Tag> : '—',
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        valueType: 'dateTime',
        search: false,
        width: 180,
      },
      {
        title: '发布人',
        dataIndex: 'publishedBy',
        ellipsis: true,
        search: false,
      },
      {
        title: '操作',
        valueType: 'option',
        width: 220,
        search: false,
        render: (_, row) => [
          <Link key="edit" href={`/admin/orchestrator/flows/${row.id}`}>
            编辑
          </Link>,
          <Link key="run" href={`/admin/orchestrator/execute?definitionId=${row.id}`}>
            执行
          </Link>,
          <a
            key="detail"
            onClick={() =>
              router.push(
                `/admin/orchestrator/executions?flowId=${encodeURIComponent(row.flowId ?? '')}`
              )
            }
          >
            执行记录
          </a>,
        ],
      },
    ],
    [router]
  );

  const request = useCallback(async (params: { flowId?: string }) => {
    const raw = await listDefinitions({
      flowId: params.flowId,
    });
    const data = normalizeList<FlowDefinitionSummary>(raw);
    return {
      data,
      success: true,
      total: data.length,
    };
  }, []);

  return (
    <ProTable<FlowDefinitionSummary>
      rowKey="id"
      columns={columns}
      request={request}
      search={{ labelWidth: 'auto' }}
      toolbar={{
        title: '流程定义',
        actions: [
          <Link key="new" href="/admin/orchestrator/flows/new">
            <Button type="primary">新建流程</Button>
          </Link>,
        ],
      }}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      dateFormatter="string"
      headerTitle={<Space>流程列表</Space>}
    />
  );
};

export default FlowListPage;
