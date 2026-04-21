'use client';

import { Collapse, Descriptions, Empty, Timeline } from 'antd';
import type React from 'react';

type ExecutionTraceProps = {
  trace: unknown;
  steps?: Array<Record<string, unknown>>;
};

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

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const ExecutionTrace: React.FC<ExecutionTraceProps> = ({ trace, steps }) => {
  const items = [
    {
      key: 'trace',
      label: 'Trace',
      children: (
        <pre className="max-h-96 overflow-auto rounded bg-neutral-50 p-3 text-xs">
          {trace === undefined || trace === null ? (
            <Empty description="无 trace" />
          ) : (
            safeJson(trace)
          )}
        </pre>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {steps && steps.length > 0 ? (
        <div>
          <div className="mb-2 font-medium">步骤明细</div>
          <Timeline
            items={steps.map((s, i) => ({
              key: String(s.id ?? i),
              children: (
                <div>
                  <div className="font-medium">
                    {String(s.name ?? s.nodeId ?? s.id ?? `Step ${i + 1}`)}
                  </div>
                  <Descriptions size="small" column={1} className="mt-2">
                    {s.status != null ? (
                      <Descriptions.Item label="状态">
                        {String(s.status)}
                      </Descriptions.Item>
                    ) : null}
                    {s.error != null ? (
                      <Descriptions.Item label="错误">
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                          {safeJson(s.error)}
                        </pre>
                      </Descriptions.Item>
                    ) : null}
                    {s.input !== undefined ? (
                      <Descriptions.Item label="输入">
                        <pre className="max-h-40 overflow-auto text-xs">
                          {safeJson(s.input)}
                        </pre>
                      </Descriptions.Item>
                    ) : null}
                    {s.output !== undefined ? (
                      <Descriptions.Item label="输出">
                        <pre className="max-h-40 overflow-auto text-xs">
                          {safeJson(normalizeToolOutput(s.output))}
                        </pre>
                      </Descriptions.Item>
                    ) : null}
                  </Descriptions>
                </div>
              ),
            }))}
          />
        </div>
      ) : null}
      <Collapse defaultActiveKey={['trace']} items={items} />
    </div>
  );
};

export default ExecutionTrace;
