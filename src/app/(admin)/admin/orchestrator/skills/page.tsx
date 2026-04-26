'use client';

import { PageContainer } from '@ant-design/pro-components';
import {
  App,
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  createSkill,
  invokeSkill,
  listSkills,
  reloadSkills,
  updateSkill,
  updateSkillStatus,
} from '@/api/orchestrator';
import { listTools } from '@/api/tools';
import { extractToolsList } from '@/lib/orchestrator';
import type { OrchestratorSkill } from '@/types/orchestrator';

const DEFAULT_LLM_PROVIDER =
  process.env.NEXT_PUBLIC_DEFAULT_LLM_PROVIDER ?? 'openai_compatible';
const DEFAULT_LLM_MODEL =
  process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL ?? 'gpt-4o-mini';

function validateSkillExecutorLocal(
  executorType: string,
  v: Record<string, unknown>,
  parsed: {
    transformMappings: Array<Record<string, unknown>>;
    validateRules: Array<Record<string, unknown>>;
  }
): string | null {
  const et = executorType || 'mcp-tool';
  if (et === 'mcp-tool') {
    const toolId = String(v.bindingToolId ?? '').trim();
    const server = String(v.bindingServer ?? '').trim();
    const toolName = String(v.bindingToolName ?? '').trim();
    if (!toolId && (!server || !toolName)) {
      return 'mcp-tool：请选择 binding.toolId，或同时填写 server + toolName';
    }
  }
  if (et === 'http' && !String(v.httpUrl ?? '').trim()) {
    return 'http：请填写 http.url';
  }
  if (et === 'condition' && !String(v.conditionExpression ?? '').trim()) {
    return 'condition：请填写 expression';
  }
  if (et === 'confirm' && !String(v.confirmMessage ?? '').trim()) {
    return 'confirm：请填写 message';
  }
  if (et === 'transform') {
    const tpl = String(v.transformTemplate ?? '').trim();
    if (!tpl && parsed.transformMappings.length === 0) {
      return 'transform：请填写 template 或至少一条 mappings';
    }
  }
  if (et === 'validate' && parsed.validateRules.length === 0) {
    return 'validate：rules 至少一条';
  }
  if (et === 'delay') {
    const d = Number(v.delayDurationMs ?? 0);
    if (!Number.isFinite(d) || d <= 0) {
      return 'delay：durationMs 须为大于 0 的数';
    }
  }
  const timeout = Number(v.timeoutMs ?? 0);
  if (timeout > 0 && (timeout < 1000 || timeout > 300_000)) {
    return 'runtimePolicy：timeoutMs 须在 1000～300000 之间';
  }
  const retry = Number(v.retry ?? 0);
  if (retry < 0 || retry > 5) {
    return 'runtimePolicy：retry 须在 0～5 之间';
  }
  const maxConc = Number(v.maxConcurrency ?? 0);
  if (maxConc > 0 && (maxConc < 1 || maxConc > 1000)) {
    return 'runtimePolicy：maxConcurrency 须在 1～1000 之间';
  }
  return null;
}

function readSkillApiError(err: unknown): { code?: string; message: string } {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { code?: string; message?: string } }).data;
    if (data && typeof data.message === 'string') {
      return { code: data.code, message: data.message };
    }
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: String(err ?? '') };
}

const SkillPage = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<OrchestratorSkill[]>([]);
  const [editing, setEditing] = useState<OrchestratorSkill | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invokeLoading, setInvokeLoading] = useState(false);
  const [invokeSkillId, setInvokeSkillId] = useState('');
  const [invokeArgsText, setInvokeArgsText] = useState('{}');
  const [invokeContextText, setInvokeContextText] = useState(
    '{"traceId":"","tenantId":"","userId":""}'
  );
  const [invokeResultText, setInvokeResultText] = useState('');
  const [contextTemplates, setContextTemplates] = useState<
    Array<{ name: string; value: string }>
  >([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [toolOptions, setToolOptions] = useState<
    Array<{ value: string; label: string; server?: string; toolName?: string }>
  >([]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSkills();
      setSkills(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(
      'orchestrator.invoke.context.templates'
    );
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Array<{ name: string; value: string }>;
      if (Array.isArray(parsed)) {
        setContextTemplates(parsed.filter((item) => item?.name && item?.value));
      }
    } catch {
      /* ignore broken local cache */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await listTools();
        if (cancelled) return;
        const tools = extractToolsList(raw);
        setToolOptions(
          tools
            .map((tool) => {
              const toolId = String(tool.toolId ?? tool.id ?? '').trim();
              if (!toolId) return null;
              const server = typeof tool.server === 'string' ? tool.server : '';
              const toolName = String(tool.name ?? '').trim();
              return {
                value: toolId,
                label: `${tool.displayName ?? tool.name ?? toolId} (${toolId})`,
                server: server || undefined,
                toolName: toolName || undefined,
              };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
        );
      } catch {
        setToolOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      skillId: '',
      name: '',
      status: 'enabled',
      executorType: 'mcp-tool',
      bindingToolId: '',
      bindingServer: '',
      bindingToolName: '',
      llmProvider: DEFAULT_LLM_PROVIDER,
      llmModel: DEFAULT_LLM_MODEL,
      llmSystemPrompt: '',
      conditionExpression: '',
      conditionOnTrue: '',
      conditionOnFalse: '',
      confirmTitle: '',
      confirmMessage: '',
      transformTemplate: '',
      transformMappings: '[]',
      validateRules: '[]',
      delayDurationMs: 1000,
      httpMethod: 'POST',
      httpUrl: '',
      httpHeaders: '{}',
      timeoutMs: 30000,
      retry: 1,
      maxConcurrency: 10,
      inputSchema: '{}',
      outputSchema: '{}',
      definition: '{}',
    });
    setOpen(true);
  };

  const openEdit = (row: OrchestratorSkill) => {
    const def = row.definition ?? {};
    const executorType = String(
      (def.executor as Record<string, unknown> | undefined)?.type ?? 'mcp-tool'
    );
    const llm = (def.llm as Record<string, unknown> | undefined) ?? {};
    const http = (def.http as Record<string, unknown> | undefined) ?? {};
    const meta =
      (def.meta as Record<string, unknown> | undefined) ??
      ({} as Record<string, unknown>);
    const fromMeta = (key: string): Record<string, unknown> =>
      ((meta[key] as Record<string, unknown> | undefined) ??
        (def[key] as Record<string, unknown> | undefined) ??
        {}) as Record<string, unknown>;
    const condition = fromMeta('condition');
    const confirm = fromMeta('confirm');
    const transform = fromMeta('transform');
    const validate = fromMeta('validate');
    const delay = fromMeta('delay');
    const llmCfg = Object.keys(llm).length > 0 ? llm : fromMeta('llm');
    setEditing(row);
    form.setFieldsValue({
      skillId: row.skillId,
      name: row.name,
      status: row.status ?? 'enabled',
      executorType,
      bindingToolId: String(row.binding?.toolId ?? ''),
      bindingServer: String(row.binding?.server ?? ''),
      bindingToolName: String(row.binding?.toolName ?? ''),
      llmProvider: String(llmCfg.provider ?? DEFAULT_LLM_PROVIDER),
      llmModel: String(llmCfg.model ?? DEFAULT_LLM_MODEL),
      llmSystemPrompt: String(llmCfg.systemPrompt ?? ''),
      conditionExpression: String(
        (condition.expression as string | undefined) ?? ''
      ),
      conditionOnTrue: String((condition.onTrue as string | undefined) ?? ''),
      conditionOnFalse: String((condition.onFalse as string | undefined) ?? ''),
      confirmTitle: String((confirm.title as string | undefined) ?? ''),
      confirmMessage: String((confirm.message as string | undefined) ?? ''),
      transformTemplate: String(
        (transform.template as string | undefined) ?? ''
      ),
      transformMappings: JSON.stringify(transform.mappings ?? [], null, 2),
      validateRules: JSON.stringify(validate.rules ?? [], null, 2),
      delayDurationMs: Number(delay.durationMs ?? 1000),
      httpMethod: String(http.method ?? 'POST'),
      httpUrl: String(http.url ?? ''),
      httpHeaders: JSON.stringify(http.headers ?? {}, null, 2),
      timeoutMs: Number(row.runtimePolicy?.timeoutMs ?? 30000),
      retry: Number(row.runtimePolicy?.retry ?? 1),
      maxConcurrency: Number(row.runtimePolicy?.maxConcurrency ?? 10),
      inputSchema: JSON.stringify(row.inputSchema ?? {}, null, 2),
      outputSchema: JSON.stringify(row.outputSchema ?? {}, null, 2),
      definition: JSON.stringify(row.definition ?? {}, null, 2),
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    let definitionObj: Record<string, unknown> = {};
    let inputSchemaObj: Record<string, unknown> = {};
    let outputSchemaObj: Record<string, unknown> = {};
    let httpHeadersObj: Record<string, string> = {};
    let transformMappingsObj: Array<Record<string, unknown>> = [];
    let validateRulesObj: Array<Record<string, unknown>> = [];
    try {
      definitionObj = JSON.parse(values.definition || '{}') as Record<
        string,
        unknown
      >;
      inputSchemaObj = JSON.parse(values.inputSchema || '{}') as Record<
        string,
        unknown
      >;
      outputSchemaObj = JSON.parse(values.outputSchema || '{}') as Record<
        string,
        unknown
      >;
      httpHeadersObj = JSON.parse(values.httpHeaders || '{}') as Record<
        string,
        string
      >;
      transformMappingsObj = JSON.parse(
        values.transformMappings || '[]'
      ) as Array<Record<string, unknown>>;
      validateRulesObj = JSON.parse(values.validateRules || '[]') as Array<
        Record<string, unknown>
      >;
    } catch {
      message.error(
        'definition/inputSchema/outputSchema/httpHeaders/transformMappings/validateRules 必须是合法 JSON'
      );
      return;
    }
    const localErr = validateSkillExecutorLocal(
      String(values.executorType || 'mcp-tool'),
      values as Record<string, unknown>,
      {
        transformMappings: transformMappingsObj,
        validateRules: validateRulesObj,
      }
    );
    if (localErr) {
      message.error(localErr);
      return;
    }
    const executorType = String(values.executorType || 'mcp-tool');
    const binding =
      executorType === 'mcp-tool'
        ? {
            toolId: values.bindingToolId || undefined,
            server: values.bindingServer || undefined,
            toolName: values.bindingToolName || undefined,
          }
        : undefined;
    const llm =
      executorType === 'llm'
        ? {
            provider: values.llmProvider || 'openai_compatible',
            model: values.llmModel || undefined,
            systemPrompt: values.llmSystemPrompt || undefined,
          }
        : undefined;
    const http =
      executorType === 'http'
        ? {
            method: values.httpMethod || 'POST',
            url: values.httpUrl || undefined,
            headers: httpHeadersObj,
          }
        : undefined;
    const condition =
      executorType === 'condition'
        ? {
            expression: values.conditionExpression || undefined,
            onTrue: values.conditionOnTrue || undefined,
            onFalse: values.conditionOnFalse || undefined,
          }
        : undefined;
    const confirm =
      executorType === 'confirm'
        ? {
            title: values.confirmTitle || undefined,
            message: values.confirmMessage || undefined,
          }
        : undefined;
    const transform =
      executorType === 'transform'
        ? {
            template: values.transformTemplate || undefined,
            mappings: transformMappingsObj,
          }
        : undefined;
    const validate =
      executorType === 'validate'
        ? {
            rules: validateRulesObj,
          }
        : undefined;
    const delay =
      executorType === 'delay'
        ? {
            durationMs: Number(values.delayDurationMs || 0),
          }
        : undefined;
    const existingMeta =
      definitionObj.meta &&
      typeof definitionObj.meta === 'object' &&
      !Array.isArray(definitionObj.meta)
        ? (definitionObj.meta as Record<string, unknown>)
        : {};
    const mergedMeta = {
      ...existingMeta,
      llm,
      condition,
      confirm,
      transform,
      validate,
      delay,
    };
    const mergedDefinition = {
      ...definitionObj,
      skillId: values.skillId,
      name: values.name,
      status: values.status,
      executor: { type: executorType },
      inputSchema: inputSchemaObj,
      outputSchema: outputSchemaObj,
      binding,
      llm,
      http,
      condition,
      confirm,
      transform,
      validate,
      delay,
      meta: mergedMeta,
      runtimePolicy: {
        timeoutMs: Number(values.timeoutMs || 30000),
        retry: Number(values.retry || 1),
        maxConcurrency: Number(values.maxConcurrency || 10),
      },
    } satisfies Record<string, unknown>;

    setSaving(true);
    try {
      if (editing) {
        const updateId = editing.id ?? editing.skillId;
        await updateSkill(updateId, {
          name: values.name,
          definition: mergedDefinition,
        });
      } else {
        await createSkill({
          skillId: values.skillId,
          name: values.name,
          definition: mergedDefinition,
        });
      }
      await reloadSkills();
      await load();
      message.success('Skill 保存成功并已 reload');
      setOpen(false);
    } catch (error) {
      const { code, message: errMsg } = readSkillApiError(error);
      if (
        code === 'invalid_skill_id_change' ||
        errMsg?.includes('skill.id cannot be changed')
      ) {
        message.error('skill ID 不可修改，请新建 skill');
      } else if (errMsg) {
        message.error(code ? `[${code}] ${errMsg}` : errMsg);
      } else {
        message.error('保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInvokeSkill = async () => {
    if (!invokeSkillId.trim()) {
      message.warning('请先输入 skillId');
      return;
    }
    setInvokeLoading(true);
    try {
      const args = JSON.parse(invokeArgsText || '{}') as Record<
        string,
        unknown
      >;
      const context = JSON.parse(invokeContextText || '{}') as Record<
        string,
        unknown
      >;
      if (!context.traceId) {
        context.traceId = `skill-debug-${Date.now()}`;
      }
      const result = await invokeSkill(invokeSkillId.trim(), {
        arguments: args,
        context,
      });
      setInvokeResultText(JSON.stringify(result, null, 2));
      message.success('Skill invoke 成功');
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error ?? '');
      setInvokeResultText(
        JSON.stringify(
          {
            ok: false,
            error: text || 'invoke failed',
          },
          null,
          2
        )
      );
      message.error('Skill invoke 失败');
    } finally {
      setInvokeLoading(false);
    }
  };

  const persistTemplates = (next: Array<{ name: string; value: string }>) => {
    setContextTemplates(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'orchestrator.invoke.context.templates',
        JSON.stringify(next)
      );
    }
  };

  return (
    <PageContainer
      title='Skill 管理'
      extra={[
        <Button
          key='reload'
          onClick={async () => {
            await reloadSkills();
            await load();
            message.success('已 reload');
          }}
        >
          手动 reload
        </Button>,
        <Button key='new' type='primary' onClick={openCreate}>
          新建 Skill
        </Button>,
      ]}
    >
      <Table<OrchestratorSkill>
        rowKey='skillId'
        loading={loading}
        dataSource={skills}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: 'skill_id', dataIndex: 'skillId', width: 260 },
          { title: 'name', dataIndex: 'name' },
          {
            title: 'binding',
            width: 280,
            render: (_, row) => {
              const toolId = String(row.binding?.toolId ?? '');
              const server = String(row.binding?.server ?? '');
              const toolName = String(row.binding?.toolName ?? '');
              return toolId || server || toolName ? (
                <Tag color='blue'>{toolId || `${server}.${toolName}`}</Tag>
              ) : (
                '-'
              );
            },
          },
          {
            title: 'executor',
            width: 130,
            render: (_, row) => {
              const execType = String(
                (
                  (row.definition as Record<string, unknown> | undefined)
                    ?.executor as Record<string, unknown> | undefined
                )?.type ?? 'mcp-tool'
              );
              return <Tag color='purple'>{execType}</Tag>;
            },
          },
          {
            title: 'status',
            dataIndex: 'status',
            render: (value) => (
              <Tag color={value === 'enabled' ? 'green' : 'default'}>
                {String(value ?? '-')}
              </Tag>
            ),
            width: 120,
          },
          { title: 'updated_at', dataIndex: 'updatedAt', width: 220 },
          {
            title: '启用',
            width: 100,
            render: (_, row) => (
              <Switch
                checked={row.status === 'enabled'}
                onChange={async (checked) => {
                  const statusTarget = row.id ?? row.skillId;
                  await updateSkillStatus(
                    statusTarget,
                    checked ? 'enabled' : 'disabled'
                  );
                  await reloadSkills();
                  await load();
                }}
              />
            ),
          },
          {
            title: '操作',
            width: 120,
            render: (_, row) => (
              <Space>
                <Button type='link' onClick={() => openEdit(row)}>
                  编辑
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? `编辑 Skill ${editing.skillId}` : '新建 Skill'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        confirmLoading={saving}
        width={760}
      >
        <Form layout='vertical' form={form}>
          <Form.Item
            label='skillId'
            name='skillId'
            rules={[{ required: true, message: '请输入 skillId' }]}
          >
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label='name' name='name'>
            <Input />
          </Form.Item>
          <Form.Item label='executor.type' name='executorType'>
            <Select
              options={[
                { value: 'mcp-tool', label: 'mcp-tool' },
                { value: 'llm', label: 'llm' },
                { value: 'http', label: 'http' },
                { value: 'condition', label: 'condition' },
                { value: 'confirm', label: 'confirm' },
                { value: 'transform', label: 'transform' },
                { value: 'validate', label: 'validate' },
                { value: 'delay', label: 'delay' },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              String(form.getFieldValue('executorType') || 'mcp-tool') ===
              'mcp-tool' ? (
                <>
                  <Form.Item label='binding.toolId' name='bindingToolId'>
                    <Select
                      showSearch
                      placeholder='请选择已注册 MCP tool'
                      options={toolOptions}
                      onChange={(value) => {
                        const selected = toolOptions.find(
                          (item) => item.value === value
                        );
                        if (!selected) return;
                        form.setFieldsValue({
                          bindingServer: selected.server ?? '',
                          bindingToolName: selected.toolName ?? '',
                        });
                      }}
                    />
                  </Form.Item>
                  <Form.Item label='binding.server' name='bindingServer'>
                    <Input placeholder='如 phv-admin' />
                  </Form.Item>
                  <Form.Item label='binding.toolName' name='bindingToolName'>
                    <Input placeholder='如 db_driver_profile' />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              String(form.getFieldValue('executorType') || 'mcp-tool') ===
              'transform' ? (
                <>
                  <Form.Item
                    label='transform.template'
                    name='transformTemplate'
                  >
                    <Input.TextArea rows={4} placeholder='可选：模板文本' />
                  </Form.Item>
                  <Form.Item
                    label='transform.mappings(JSON)'
                    name='transformMappings'
                  >
                    <Input.TextArea rows={6} className='font-mono text-xs' />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              String(form.getFieldValue('executorType') || 'mcp-tool') ===
              'validate' ? (
                <Form.Item label='validate.rules(JSON)' name='validateRules'>
                  <Input.TextArea rows={8} className='font-mono text-xs' />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              String(form.getFieldValue('executorType') || 'mcp-tool') ===
              'delay' ? (
                <Form.Item label='delay.durationMs' name='delayDurationMs'>
                  <Input type='number' />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              String(form.getFieldValue('executorType') || 'mcp-tool') ===
              'llm' ? (
                <>
                  <div className='mb-2 rounded bg-blue-50 p-2 text-xs text-blue-700'>
                    llm 类型默认使用系统配置（可按需覆盖）。
                  </div>
                  <Form.Item label='llm.provider' name='llmProvider'>
                    <Input disabled />
                  </Form.Item>
                  <Form.Item label='llm.model' name='llmModel'>
                    <Input disabled />
                  </Form.Item>
                  <Form.Item label='llm.systemPrompt' name='llmSystemPrompt'>
                    <Input.TextArea rows={4} />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              String(form.getFieldValue('executorType') || 'mcp-tool') ===
              'http' ? (
                <>
                  <Form.Item label='http.method' name='httpMethod'>
                    <Select
                      options={[
                        { value: 'GET', label: 'GET' },
                        { value: 'POST', label: 'POST' },
                        { value: 'PUT', label: 'PUT' },
                        { value: 'DELETE', label: 'DELETE' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label='http.url' name='httpUrl'>
                    <Input placeholder='如 https://api.example.com/query' />
                  </Form.Item>
                  <Form.Item label='http.headers(JSON)' name='httpHeaders'>
                    <Input.TextArea rows={4} className='font-mono text-xs' />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              String(form.getFieldValue('executorType') || 'mcp-tool') ===
              'condition' ? (
                <>
                  <Form.Item
                    label='condition.expression'
                    name='conditionExpression'
                  >
                    <Input placeholder='例如 {{gt .input.score 60}}' />
                  </Form.Item>
                  <Form.Item label='condition.onTrue' name='conditionOnTrue'>
                    <Input placeholder='命中后输出路径或结果标识' />
                  </Form.Item>
                  <Form.Item label='condition.onFalse' name='conditionOnFalse'>
                    <Input placeholder='未命中后输出路径或结果标识' />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() =>
              String(form.getFieldValue('executorType') || 'mcp-tool') ===
              'confirm' ? (
                <>
                  <Form.Item label='confirm.title' name='confirmTitle'>
                    <Input placeholder='例如 风险确认' />
                  </Form.Item>
                  <Form.Item label='confirm.message' name='confirmMessage'>
                    <Input.TextArea rows={4} placeholder='确认文案' />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item label='status' name='status'>
            <Select
              options={[
                { value: 'enabled', label: 'enabled' },
                { value: 'disabled', label: 'disabled' },
                { value: 'deprecated', label: 'deprecated' },
              ]}
            />
          </Form.Item>
          <Form.Item label='runtimePolicy.timeoutMs' name='timeoutMs'>
            <Input type='number' />
          </Form.Item>
          <Form.Item label='runtimePolicy.retry' name='retry'>
            <Input type='number' />
          </Form.Item>
          <Form.Item label='runtimePolicy.maxConcurrency' name='maxConcurrency'>
            <Input type='number' />
          </Form.Item>
          <Form.Item label='inputSchema(JSON)' name='inputSchema'>
            <Input.TextArea rows={8} className='font-mono text-xs' />
          </Form.Item>
          <Form.Item label='outputSchema(JSON)' name='outputSchema'>
            <Input.TextArea rows={8} className='font-mono text-xs' />
          </Form.Item>
          <Form.Item label='definition(JSON)' name='definition'>
            <Input.TextArea rows={12} className='font-mono text-xs' />
          </Form.Item>
        </Form>
      </Modal>

      <div className='mt-4 rounded border border-neutral-200 p-4'>
        <div className='mb-3 text-sm font-medium'>Skill 联调入口（P0）</div>
        <Space direction='vertical' className='w-full'>
          <Input
            value={invokeSkillId}
            onChange={(e) => setInvokeSkillId(e.target.value)}
            placeholder='skillId，例如 bill.query.summary'
          />
          <Input.TextArea
            rows={6}
            value={invokeArgsText}
            onChange={(e) => setInvokeArgsText(e.target.value)}
            className='font-mono text-xs'
            placeholder='arguments JSON，例如 {"orderId":"123"}'
          />
          <Input.TextArea
            rows={4}
            value={invokeContextText}
            onChange={(e) => setInvokeContextText(e.target.value)}
            className='font-mono text-xs'
            placeholder='context JSON，例如 {"traceId":"t-1","tenantId":"demo","userId":"u-1","business_id":"demo","governanceMode":"warn"}'
          />
          <Space wrap>
            <Select
              allowClear
              style={{ minWidth: 260 }}
              placeholder='选择 context 模板'
              value={selectedTemplateName || undefined}
              options={contextTemplates.map((item) => ({
                value: item.name,
                label: item.name,
              }))}
              onChange={(name) => {
                const nextName = String(name ?? '');
                setSelectedTemplateName(nextName);
                const target = contextTemplates.find(
                  (item) => item.name === nextName
                );
                if (target?.value) {
                  setInvokeContextText(target.value);
                }
              }}
            />
            <Button
              onClick={() => {
                const name = window.prompt('请输入模板名');
                if (!name) return;
                const normalized = name.trim();
                if (!normalized) return;
                const next = [
                  ...contextTemplates.filter(
                    (item) => item.name !== normalized
                  ),
                  { name: normalized, value: invokeContextText },
                ];
                persistTemplates(next);
                setSelectedTemplateName(normalized);
                message.success('context 模板已保存');
              }}
            >
              保存模板
            </Button>
            <Button
              danger
              disabled={!selectedTemplateName}
              onClick={() => {
                if (!selectedTemplateName) return;
                const next = contextTemplates.filter(
                  (item) => item.name !== selectedTemplateName
                );
                persistTemplates(next);
                setSelectedTemplateName('');
                message.success('模板已删除');
              }}
            >
              删除模板
            </Button>
          </Space>
          <Divider style={{ margin: '4px 0' }} />
          <Space>
            <Button
              type='primary'
              loading={invokeLoading}
              onClick={handleInvokeSkill}
            >
              调用 invokeSkill
            </Button>
          </Space>
          <Input.TextArea
            rows={10}
            value={invokeResultText}
            readOnly
            className='font-mono text-xs'
            placeholder='调用结果会显示在这里'
          />
          {(() => {
            try {
              const parsed = invokeResultText
                ? (JSON.parse(invokeResultText) as Record<string, unknown>)
                : null;
              const meta =
                parsed && typeof parsed === 'object'
                  ? (parsed.meta as Record<string, unknown> | undefined)
                  : undefined;
              const gov = meta?.governance as
                | {
                    mode?: string;
                    passed?: number;
                    total?: number;
                    blocked?: boolean;
                    pending?: boolean;
                    decisionToken?: string;
                    issues?: string[];
                  }
                | undefined;
              if (!gov) return null;
              return (
                <div className='rounded border border-amber-200 bg-amber-50 p-3 text-xs'>
                  <div className='mb-1 font-medium text-amber-800'>
                    Governance 摘要
                  </div>
                  <div>mode: {String(gov.mode ?? '-')}</div>
                  <div>
                    checks: {String(gov.passed ?? 0)}/{String(gov.total ?? 0)}
                  </div>
                  <div>blocked: {String(Boolean(gov.blocked))}</div>
                  <div>pending: {String(Boolean(gov.pending))}</div>
                  {gov.decisionToken ? (
                    <div>decisionToken: {gov.decisionToken}</div>
                  ) : null}
                  {Array.isArray(gov.issues) && gov.issues.length > 0 ? (
                    <pre className='mt-2 max-h-24 overflow-auto whitespace-pre-wrap'>
                      {JSON.stringify(gov.issues, null, 2)}
                    </pre>
                  ) : null}
                </div>
              );
            } catch {
              return null;
            }
          })()}
        </Space>
      </div>
    </PageContainer>
  );
};

export default SkillPage;
