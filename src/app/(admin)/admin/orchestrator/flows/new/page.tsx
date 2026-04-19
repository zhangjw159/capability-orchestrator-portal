'use client';

import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Form, Input, Space } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getDefaultTemplate, saveDefinition, validateFlow } from '@/api/orchestrator';
import JsonEditor from '@/components/orchestrator/JsonEditor';
import { parseFlowDsl } from '@/lib/orchestrator';
import type { Flow } from '@/types/orchestrator';

const defaultFlowText = `{
  "version": "1",
  "id": "my-flow",
  "name": "新流程",
  "nodes": [],
  "edges": []
}`;

const NewFlowPage = () => {
  const { message } = App.useApp();
  const router = useRouter();
  const [text, setText] = useState(defaultFlowText);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await getDefaultTemplate();
        const inner =
          raw && typeof raw === 'object' && 'data' in (raw as object)
            ? (raw as { data: unknown }).data
            : raw;
        const flow = parseFlowDsl(
          inner && typeof inner === 'object' && inner !== null && 'dsl' in inner
            ? (inner as { dsl: unknown }).dsl
            : inner && typeof inner === 'object' && 'flow' in inner
              ? (inner as { flow: unknown }).flow
              : inner
        );
        if (!cancelled && flow) {
          setText(JSON.stringify(flow, null, 2));
        }
      } catch {
        if (!cancelled) message.warning('无法加载默认模板，已使用本地占位 DSL');
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [message]);

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
      /* notification from request */
    }
  }, [parseFlow, message]);

  const handleSave = useCallback(async () => {
    const flow = parseFlow();
    if (!flow) return;
    setSaving(true);
    try {
      await validateFlow(flow);
      await saveDefinition({
        name: flow.name,
        flowId: flow.id,
        dsl: flow,
      });
      message.success('已保存草稿');
      router.push('/admin/orchestrator/flows');
    } catch {
      /* request 已提示 */
    } finally {
      setSaving(false);
    }
  }, [parseFlow, message, router]);

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
      <Form layout="vertical" className="max-w-4xl">
        <p className="text-neutral-500 mb-4">
          基于默认模板编辑 Flow DSL（JSON），保存前会调用校验接口。
        </p>
        <Form.Item label="DSL JSON">
          <JsonEditor value={text} onChange={setText} parseError={parseError} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button onClick={handleValidate}>预校验</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              保存草稿
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </PageContainer>
  );
};

export default NewFlowPage;
