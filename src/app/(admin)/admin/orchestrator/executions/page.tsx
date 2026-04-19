'use client';

import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Button, Space, Spin, Tag } from 'antd';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo } from 'react';

import { listExecutions } from '@/api/orchestrator';
import { normalizeList } from '@/lib/orchestrator';
import type { ExecutionSummary } from '@/types/orchestrator';

const ExecutionsPageInner = () => {
  const searchParams = useSearchParams();
  const initialFlowId = searchParams.get('flowId') || undefined;

  const columns = useMemo<ProColumns<ExecutionSummary>[]>(
    () => [
      {
        title: 'flowId',
        dataIndex: 'flowId',
        ellipsis: true,
      },
      {
        title: '执行 ID',
        dataIndex: 'id',
        copyable: true,
        ellipsis: true,
        search: false,
        render: (_, row) => String(row.executionId ?? row.id ?? '—'),
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
        title: '开始时间',
        dataIndex: 'startedAt',
        valueType: 'dateTime',
        search: false,
        width: 180,
      },
      {
        title: '结束时间',
        dataIndex: 'finishedAt',
        valueType: 'dateTime',
        search: false,
        width: 180,
      },
      {
        title: '操作',
        valueType: 'option',
        width: 100,
        search: false,
        render: (_, row) => {
          const id = String(row.executionId ?? row.id ?? '');
          return [
            <Link key="detail" href={`/admin/orchestrator/executions/${encodeURIComponent(id)}`}>
              详情
            </Link>,
          ];
        },
      },
    ],
    []
  );

  const request = useCallback(async (params: { flowId?: string }) => {
    const raw = await listExecutions({
      flowId: params.flowId,
    });
    const data = normalizeList<ExecutionSummary>(raw);
    return {
      data,
      success: true,
      total: data.length,
    };
  }, []);

  return (
    <ProTable<ExecutionSummary>
      rowKey={(row) => String(row.executionId ?? row.id)}
      columns={columns}
      request={request}
      form={{ initialValues: { flowId: initialFlowId } }}
      search={{ labelWidth: 'auto', defaultCollapsed: false }}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      dateFormatter="string"
      headerTitle={<Space>执行历史</Space>}
      toolbar={{
        actions: [
          <Link key="exec" href="/admin/orchestrator/execute">
            <Button type="primary">去执行</Button>
          </Link>,
        ],
      }}
    />
  );
};

const ExecutionsPage = () => (
  <Suspense
    fallback={
      <div className="flex justify-center py-24">
        <Spin size="large" />
      </div>
    }
  >
    <ExecutionsPageInner />
  </Suspense>
);

export default ExecutionsPage;
