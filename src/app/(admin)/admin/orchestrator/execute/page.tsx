'use client';

import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Form, Input, Radio, Space, Spin } from 'antd';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';

import { executeFlow } from '@/api/orchestrator';
import ExecutionTrace from '@/components/orchestrator/ExecutionTrace';
import JsonEditor from '@/components/orchestrator/JsonEditor';
import { parseFlowDsl } from '@/lib/orchestrator';
import type { Flow } from '@/types/orchestrator';

const ExecutePageInner = () => {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const definitionIdFromQuery = searchParams.get('definitionId') || '';

  const [mode, setMode] = useState<'definition' | 'inline'>(
    definitionIdFromQuery ? 'definition' : 'inline'
  );
  const [definitionId, setDefinitionId] = useState(definitionIdFromQuery);
  const [flowText, setFlowText] = useState(`{
  "version": "v1",
  "id": "debug-flow",
  "name": "调试",
  "nodes": [],
  "edges": []
}`);
  const [inputText, setInputText] = useState('{}');
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleRun = useCallback(async () => {
    setParseError(null);
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(inputText) as Record<string, unknown>;
    } catch (e) {
      setParseError(`执行参数 JSON 无效：${e instanceof Error ? e.message : ''}`);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      if (mode === 'definition') {
        if (!definitionId.trim()) {
          message.warning('请填写 flowDefinitionId');
          setLoading(false);
          return;
        }
        const res = await executeFlow({
          flowDefinitionId: definitionId.trim(),
          input,
        });
        setResult(res as Record<string, unknown>);
        message.success('执行完成');
        return;
      }

      let flow: Flow | null = null;
      try {
        flow = JSON.parse(flowText) as Flow;
      } catch (e) {
        setParseError(`Flow JSON 无效：${e instanceof Error ? e.message : ''}`);
        return;
      }
      const normalized = parseFlowDsl(flow) ?? flow;
      const res = await executeFlow({
        flow: normalized,
        input,
      });
      setResult(res as Record<string, unknown>);
      message.success('执行完成');
    } catch {
      /* request */
    } finally {
      setLoading(false);
    }
  }, [mode, definitionId, inputText, flowText, message]);

  const trace = result?.trace;
  const steps = (result?.steps as Array<Record<string, unknown>> | undefined) ?? undefined;
  const output = result?.output;

  return (
    <PageContainer
      title="执行调试"
      extra={[
        <Link key="list" href="/admin/orchestrator/executions">
          <Button>执行历史</Button>
        </Link>,
      ]}
    >
      <div className="flex max-w-5xl flex-col gap-6">
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          optionType="button"
        >
          <Radio.Button value="definition">按流程定义执行</Radio.Button>
          <Radio.Button value="inline">临时 Flow 调试</Radio.Button>
        </Radio.Group>

        {mode === 'definition' ? (
          <Form layout="vertical">
            <Form.Item label="flowDefinitionId" required>
              <Input
                value={definitionId}
                onChange={(e) => setDefinitionId(e.target.value)}
                placeholder="从流程列表进入会自动带上"
              />
            </Form.Item>
          </Form>
        ) : (
          <Form layout="vertical">
            <Form.Item label="Flow JSON（临时调试）">
              <JsonEditor value={flowText} onChange={setFlowText} parseError={parseError} />
            </Form.Item>
          </Form>
        )}

        <Form layout="vertical">
          <Form.Item label="执行参数 input（JSON 对象）">
            <Input.TextArea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="font-mono text-sm"
            />
          </Form.Item>
        </Form>

        <Space>
          <Button type="primary" loading={loading} onClick={handleRun}>
            执行
          </Button>
        </Space>

        {result ? (
          <div className="rounded border border-neutral-200 p-4">
            <div className="mb-2 font-medium">执行结果</div>
            <pre className="mb-4 max-h-64 overflow-auto rounded bg-neutral-50 p-3 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
            {output !== undefined ? (
              <div className="mb-4">
                <div className="mb-1 font-medium">output</div>
                <pre className="max-h-64 overflow-auto rounded bg-neutral-50 p-3 text-xs">
                  {JSON.stringify(output, null, 2)}
                </pre>
              </div>
            ) : null}
            <ExecutionTrace trace={trace} steps={steps} />
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
};

const ExecutePage = () => (
  <Suspense
    fallback={
      <div className="flex justify-center py-24">
        <Spin size="large" />
      </div>
    }
  >
    <ExecutePageInner />
  </Suspense>
);

export default ExecutePage;
