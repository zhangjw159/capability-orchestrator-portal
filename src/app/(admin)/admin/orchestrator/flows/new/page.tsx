'use client';

import { PageContainer } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getDefaultTemplate, listSkills } from '@/api/orchestrator';
import FlowCanvasEditor from '@/components/orchestrator/FlowCanvasEditor';
import { parseFlowDsl } from '@/lib/orchestrator';
import type { Flow, OrchestratorSkill } from '@/types/orchestrator';

const defaultFlowText = `{
  "version": "v1",
  "id": "my-flow",
  "name": "新流程",
  "nodes": [],
  "edges": []
}`;

const NewFlowPage = () => {
  const { message } = App.useApp();
  const router = useRouter();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [skills, setSkills] = useState<OrchestratorSkill[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [raw, skillList] = await Promise.all([getDefaultTemplate(), listSkills()]);
        const inner =
          raw && typeof raw === 'object' && 'data' in (raw as object)
            ? (raw as { data: unknown }).data
            : raw;
        const parsed = parseFlowDsl(
          inner && typeof inner === 'object' && inner !== null && 'dsl' in inner
            ? (inner as { dsl: unknown }).dsl
            : inner && typeof inner === 'object' && 'flow' in inner
              ? (inner as { flow: unknown }).flow
              : inner
        );
        if (!cancelled) {
          setSkills(skillList);
          if (parsed) setFlow(parsed);
          else setFlow(JSON.parse(defaultFlowText) as Flow);
        }
      } catch {
        if (!cancelled) message.warning('无法加载默认模板，已使用本地占位 DSL');
        if (!cancelled) setFlow(JSON.parse(defaultFlowText) as Flow);
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [message]);

  return (
    <PageContainer
      title="新建流程"
      loading={loadingTemplate}
      extra={[
        <Link key="back" href="/admin/orchestrator/flows">
          <Button>返回列表</Button>
        </Link>,
      ]}
    >
      {flow ? (
        <FlowCanvasEditor
          initialFlow={flow}
          skills={skills}
          onSaved={() => router.push('/admin/orchestrator/flows')}
        />
      ) : null}
    </PageContainer>
  );
};

export default NewFlowPage;
