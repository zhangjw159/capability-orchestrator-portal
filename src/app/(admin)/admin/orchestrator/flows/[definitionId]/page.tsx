'use client';

import { PageContainer } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getDefinition, listSkills } from '@/api/orchestrator';
import FlowCanvasEditor from '@/components/orchestrator/FlowCanvasEditor';
import { parseFlowDsl } from '@/lib/orchestrator';
import type { Flow, OrchestratorSkill } from '@/types/orchestrator';

const EditFlowPage = () => {
  const { message } = App.useApp();
  const params = useParams();
  const definitionId = String(params.definitionId ?? '');

  const [flow, setFlow] = useState<Flow | null>(null);
  const [skills, setSkills] = useState<OrchestratorSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!definitionId) return;
    let cancelled = false;
    (async () => {
      try {
        const [detail, skillList] = await Promise.all([getDefinition(definitionId), listSkills()]);
        const parsed = parseFlowDsl(detail.dsl);
        if (!cancelled) {
          setSkills(skillList);
          if (parsed) setFlow(parsed);
          else {
            setFlow({
              version: 'v1',
              id: detail.flowId || `flow-${definitionId}`,
              name: detail.name || '未命名流程',
              nodes: [],
              edges: [],
            });
          }
        }
      } catch {
        if (!cancelled) message.error('加载流程定义失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [definitionId, message]);

  return (
    <PageContainer
      title={`编辑流程 ${definitionId}`}
      loading={loading}
      extra={[
        <Link key="back" href="/admin/orchestrator/flows">
          <Button>返回列表</Button>
        </Link>,
        <Link key="run" href={`/admin/orchestrator/execute?definitionId=${definitionId}`}>
          <Button>去执行</Button>
        </Link>,
      ]}
    >
      {flow ? <FlowCanvasEditor definitionId={definitionId} initialFlow={flow} skills={skills} /> : null}
    </PageContainer>
  );
};

export default EditFlowPage;
