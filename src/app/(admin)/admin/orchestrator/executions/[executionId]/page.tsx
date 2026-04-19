'use client';

import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Descriptions, Spin } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getExecution } from '@/api/orchestrator';
import ExecutionTrace from '@/components/orchestrator/ExecutionTrace';
import type { ExecutionDetail, ExecutionStep } from '@/types/orchestrator';

const ExecutionDetailPage = () => {
  const { message } = App.useApp();
  const params = useParams();
  const executionId = decodeURIComponent(String(params.executionId ?? ''));

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);

  useEffect(() => {
    if (!executionId) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await getExecution(executionId);
        if (!cancelled) setDetail(d as ExecutionDetail);
      } catch {
        if (!cancelled) message.error('加载执行详情失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [executionId, message]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  if (!detail) {
    return (
      <PageContainer title="执行详情">
        <p>未找到记录</p>
        <Link href="/admin/orchestrator/executions">
          <Button type="link">返回列表</Button>
        </Link>
      </PageContainer>
    );
  }

  const steps = (detail.steps as ExecutionStep[] | undefined) ?? undefined;

  return (
    <PageContainer
      title={`执行详情 ${executionId}`}
      extra={[
        <Link key="back" href="/admin/orchestrator/executions">
          <Button>返回列表</Button>
        </Link>,
      ]}
    >
      <Descriptions bordered column={1} size="small" className="mb-6 max-w-3xl">
        <Descriptions.Item label="flowId">{String(detail.flowId ?? '—')}</Descriptions.Item>
        <Descriptions.Item label="状态">{String(detail.status ?? '—')}</Descriptions.Item>
        <Descriptions.Item label="开始时间">
          {String(detail.startedAt ?? detail.createdAt ?? '—')}
        </Descriptions.Item>
        <Descriptions.Item label="结束时间">{String(detail.finishedAt ?? '—')}</Descriptions.Item>
      </Descriptions>

      {detail.error != null ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm">
          <div className="font-medium text-red-800">错误</div>
          <pre className="mt-2 whitespace-pre-wrap text-xs">
            {typeof detail.error === 'string'
              ? detail.error
              : JSON.stringify(detail.error, null, 2)}
          </pre>
        </div>
      ) : null}

      {detail.output !== undefined ? (
        <div className="mb-6">
          <div className="mb-2 font-medium">输出</div>
          <pre className="max-h-64 overflow-auto rounded bg-neutral-50 p-3 text-xs">
            {JSON.stringify(detail.output, null, 2)}
          </pre>
        </div>
      ) : null}

      <ExecutionTrace trace={detail.trace} steps={steps as Array<Record<string, unknown>> | undefined} />
    </PageContainer>
  );
};

export default ExecutionDetailPage;
