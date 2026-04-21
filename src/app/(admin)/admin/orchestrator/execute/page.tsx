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

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  if (!raw) return value;
  try {
    return JSON.parse(raw);
  } catch {
    return value;
  }
}

function normalizeToolOutput(output: unknown): unknown {
  if (!output || typeof output !== 'object') return output;
  const obj = output as Record<string, unknown>;
  const content = obj.content;
  if (!Array.isArray(content)) return output;
  const normalized = content.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const row = item as Record<string, unknown>;
    if (typeof row.text !== 'string') return item;
    return { ...row, text: parseMaybeJson(row.text) };
  });
  return { ...obj, content: normalized };
}

function normalizeExecutionResult(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const result = value as Record<string, unknown>;
  const next: Record<string, unknown> = { ...result };
  if (next.output !== undefined) {
    next.output = normalizeToolOutput(next.output);
  }
  if (Array.isArray(next.trace)) {
    next.trace = next.trace.map((step) => {
      if (!step || typeof step !== 'object') return step;
      const row = step as Record<string, unknown>;
      if (row.output === undefined) return step;
      return { ...row, output: normalizeToolOutput(row.output) };
    });
  }
  if (Array.isArray(next.steps)) {
    next.steps = next.steps.map((step) => {
      if (!step || typeof step !== 'object') return step;
      const row = step as Record<string, unknown>;
      if (row.output === undefined) return step;
      return { ...row, output: normalizeToolOutput(row.output) };
    });
  }
  return next;
}

const ExecutePageInner = () => {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const definitionIdFromQuery = searchParams.get('definitionId') || '';

  const [mode, setMode] = useState<'definition' | 'inline'>(
    definitionIdFromQuery ? 'definition' : 'inline'
  );
  const [definitionId, setDefinitionId] = useState(definitionIdFromQuery);
  const [flowText, setFlowText] = useState(`{
  "version": "flow/v1",
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
        setResult(normalizeExecutionResult(res) as Record<string, unknown>);
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
      setResult(normalizeExecutionResult(res) as Record<string, unknown>);
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
