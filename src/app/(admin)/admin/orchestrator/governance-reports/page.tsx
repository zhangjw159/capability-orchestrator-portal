'use client';

import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Card, Input, Space, Tag } from 'antd';
import { useMemo, useState } from 'react';

import { getGovernanceReport } from '@/api/orchestrator';
import type {
  GovernanceReportItem,
  GovernanceReportResponse,
} from '@/types/orchestrator';

const GovernanceReportsPage = () => {
  const [flowId, setFlowId] = useState('');
  const [summary, setSummary] = useState<
    GovernanceReportResponse['summary'] | null
  >(null);
  const columns = useMemo<ProColumns<GovernanceReportItem>[]>(
    () => [
      { title: 'executionId', dataIndex: 'executionId', width: 180 },
      { title: 'flowId', dataIndex: 'flowId' },
      { title: 'mode', dataIndex: 'mode', width: 120 },
      {
        title: 'checks',
        width: 120,
        render: (_, row) => `${row.passed}/${row.total}`,
      },
      {
        title: 'blocked',
        width: 120,
        render: (_, row) =>
          row.blocked ? (
            <Tag color='red'>true</Tag>
          ) : (
            <Tag color='green'>false</Tag>
          ),
      },
      {
        title: 'issues',
        dataIndex: 'issues',
        render: (_, row) => (row.issues ?? []).join(' | ') || '-',
      },
    ],
    []
  );

  return (
    <PageContainer title='Governance Reports'>
      <Card size='small' className='mb-3'>
        <Space>
          <span>flowId</span>
          <Input
            placeholder='可选：按 flowId 过滤'
            value={flowId}
            onChange={(e) => setFlowId(e.target.value)}
            style={{ width: 320 }}
          />
        </Space>
        {summary ? (
          <div className='mt-2 text-xs text-neutral-600'>
            totalExecutions={summary.totalExecutions}, withGovernance=
            {summary.withGovernance}, blocked={summary.blocked}, checks=
            {summary.passedChecks}/{summary.totalChecks}
          </div>
        ) : null}
      </Card>
      <ProTable<GovernanceReportItem>
        rowKey='executionId'
        columns={columns}
        search={false}
        request={async () => {
          const res = await getGovernanceReport({
            flowId: flowId.trim() || undefined,
          });
          setSummary(res.summary);
          return {
            data: res.items ?? [],
            success: true,
            total: (res.items ?? []).length,
          };
        }}
      />
    </PageContainer>
  );
};

export default GovernanceReportsPage;
