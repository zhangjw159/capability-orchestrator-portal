'use client';

import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Form, Space } from 'antd';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getDefinition, publishDefinition, saveDefinition, validateFlow } from '@/api/orchestrator';
import JsonEditor from '@/components/orchestrator/JsonEditor';
import { parseFlowDsl } from '@/lib/orchestrator';
import type { Flow } from '@/types/orchestrator';

const EditFlowPage = () => {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useParams();
  const definitionId = String(params.definitionId ?? '');

  const [text, setText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!definitionId) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await getDefinition(definitionId);
        const flow = parseFlowDsl(detail.dsl);
        if (!cancelled) {
          if (flow) setText(JSON.stringify(flow, null, 2));
          else setText(JSON.stringify(detail.dsl ?? {}, null, 2));
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

  const parseFlow = useCallback((): Flow | null => {
    setParseError(null);
    try {
      const v = JSON.parse(text) as Flow;
      if (!v?.nodes || !v?.edges) {
        setParseError('DSL 需包含 nodes 与 edges 数组');
        return null;
      }
      return v;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'JSON 解析失败';
      setParseError(msg);
      return null;
    }
  }, [text]);

  const handleValidate = useCallback(async () => {
    const flow = parseFlow();
    if (!flow) return;
    try {
      const res = await validateFlow(flow);
      if (res?.valid === false) {
        message.error(res?.message || (res?.errors ?? []).join('; ') || '校验未通过');
        return;
      }
      message.success('校验通过');
    } catch {
      /* notification */
    }
  }, [parseFlow, message]);

  const handleSave = useCallback(async () => {
    const flow = parseFlow();
    if (!flow) return;
    setSaving(true);
    try {
      await validateFlow(flow);
      await saveDefinition({
        definitionId,
        id: definitionId,
        name: flow.name,
        flowId: flow.id,
        dsl: flow,
      });
      message.success('已保存');
      router.refresh();
    } catch {
      /* */
    } finally {
      setSaving(false);
    }
  }, [parseFlow, message, router, definitionId]);

  const handlePublish = useCallback(async () => {
    const flow = parseFlow();
    if (!flow) return;
    setPublishing(true);
    try {
      await validateFlow(flow);
      await saveDefinition({
        definitionId,
        id: definitionId,
        name: flow.name,
        flowId: flow.id,
        dsl: flow,
      });
      await publishDefinition(definitionId);
      message.success('已发布');
      router.push('/admin/orchestrator/flows');
    } catch {
      /* */
    } finally {
      setPublishing(false);
    }
  }, [parseFlow, message, router, definitionId]);

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
      <Form layout="vertical" className="max-w-4xl">
        <Form.Item label="DSL JSON">
          <JsonEditor value={text} onChange={setText} parseError={parseError} />
        </Form.Item>
        <Form.Item>
          <Space wrap>
            <Button onClick={handleValidate}>预校验</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              保存草稿
            </Button>
            <Button type="primary" danger loading={publishing} onClick={handlePublish}>
              校验并发布
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </PageContainer>
  );
};

export default EditFlowPage;
