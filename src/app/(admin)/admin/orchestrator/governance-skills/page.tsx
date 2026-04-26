'use client';

import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Form, Input, Modal, Space, Table, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  approveGovernanceDecision,
  createGovernanceSkill,
  listGovernanceDecisions,
  listGovernanceSkills,
  rejectGovernanceDecision,
  reviewGovernanceSkill,
  updateGovernanceSkill,
} from '@/api/orchestrator';
import type {
  GovernanceDecision,
  GovernanceReviewResponse,
  GovernanceSkill,
} from '@/types/orchestrator';

const GovernanceSkillPage = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<GovernanceSkill[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GovernanceSkill | null>(null);
  const [reviewSkillId, setReviewSkillId] = useState('');
  const [reviewHeadersText, setReviewHeadersText] = useState(
    '{"business_id":"demo"}'
  );
  const [reviewResponseText, setReviewResponseText] = useState('{}');
  const [reviewResult, setReviewResult] =
    useState<GovernanceReviewResponse | null>(null);
  const [decisions, setDecisions] = useState<GovernanceDecision[]>([]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listGovernanceSkills();
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDecisions = useCallback(async () => {
    const rows = await listGovernanceDecisions({ status: 'pending' });
    setDecisions(rows);
  }, []);

  useEffect(() => {
    void loadDecisions();
  }, [loadDecisions]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      id: '',
      name: '',
      description: '',
      domain: 'rms-driver-list',
      content: '',
      checklist: JSON.stringify(
        [
          'Request without business_id is rejected by business rules',
          'driver_name supports fuzzy match',
          'nric supports fuzzy match',
          'phone supports fuzzy match',
          'Combined filters behave as AND',
          'No cross-business driver leakage in returned data',
        ],
        null,
        2
      ),
      runtimeSkillIds: JSON.stringify(['driver_list'], null, 2),
      status: 'enabled',
      version: 'v1',
    });
    setOpen(true);
  };

  const openEdit = (row: GovernanceSkill) => {
    setEditing(row);
    form.setFieldsValue({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      domain: row.domain ?? '',
      content: row.content ?? '',
      checklist: JSON.stringify(row.checklist ?? [], null, 2),
      runtimeSkillIds: JSON.stringify(row.runtimeSkillIds ?? [], null, 2),
      status: row.status ?? 'enabled',
      version: row.version ?? 'v1',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    let checklist: string[] = [];
    let runtimeSkillIds: string[] = [];
    try {
      checklist = JSON.parse(values.checklist || '[]') as string[];
      runtimeSkillIds = JSON.parse(values.runtimeSkillIds || '[]') as string[];
    } catch {
      message.error('checklist/runtimeSkillIds 必须为 JSON 数组');
      return;
    }
    const payload: GovernanceSkill = {
      id: String(values.id).trim(),
      name: String(values.name).trim(),
      description: String(values.description ?? ''),
      domain: String(values.domain ?? ''),
      content: String(values.content ?? ''),
      checklist,
      runtimeSkillIds,
      status: String(values.status ?? 'enabled'),
      version: String(values.version ?? 'v1'),
    };
    setSaving(true);
    try {
      if (editing?.id) {
        await updateGovernanceSkill(editing.id, { skill: payload });
      } else {
        await createGovernanceSkill({ skill: payload });
      }
      setOpen(false);
      await load();
      message.success('治理 Skill 保存成功');
    } catch (error) {
      const text =
        error && typeof error === 'object' && 'data' in error
          ? String(
              (error as { data?: { message?: string } }).data?.message ?? ''
            )
          : String(error ?? '');
      message.error(text || '治理 Skill 保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async () => {
    if (!reviewSkillId.trim()) {
      message.warning('请先输入治理 skill id');
      return;
    }
    try {
      const headers = JSON.parse(reviewHeadersText || '{}') as Record<
        string,
        unknown
      >;
      const response = JSON.parse(reviewResponseText || '{}') as Record<
        string,
        unknown
      >;
      const result = await reviewGovernanceSkill(reviewSkillId.trim(), {
        headers,
        response,
      });
      setReviewResult(result);
      message.success('评审完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '评审失败');
    }
  };

  return (
    <PageContainer
      title='Governance Skill Center'
      extra={[
        <Button key='new' type='primary' onClick={openCreate}>
          新建治理 Skill
        </Button>,
      ]}
    >
      <Table<GovernanceSkill>
        rowKey='id'
        loading={loading}
        dataSource={items}
        columns={[
          { title: 'id', dataIndex: 'id', width: 240 },
          { title: 'name', dataIndex: 'name' },
          { title: 'domain', dataIndex: 'domain', width: 180 },
          {
            title: 'runtime links',
            width: 220,
            render: (_, row) => (row.runtimeSkillIds ?? []).join(', ') || '-',
          },
          {
            title: 'status',
            width: 120,
            render: (_, row) => <Tag>{row.status ?? '-'}</Tag>,
          },
          {
            title: '操作',
            width: 120,
            render: (_, row) => (
              <Button type='link' onClick={() => openEdit(row)}>
                编辑
              </Button>
            ),
          },
        ]}
      />

      <div className='mt-4 rounded border border-neutral-200 p-4'>
        <div className='mb-2 text-sm font-medium'>治理评审（Review）</div>
        <Space direction='vertical' className='w-full'>
          <Input
            value={reviewSkillId}
            onChange={(e) => setReviewSkillId(e.target.value)}
            placeholder='治理 skill id，例如 rms-driver-list-business-flow'
          />
          <Input.TextArea
            rows={4}
            value={reviewHeadersText}
            onChange={(e) => setReviewHeadersText(e.target.value)}
            className='font-mono text-xs'
            placeholder='headers JSON'
          />
          <Input.TextArea
            rows={6}
            value={reviewResponseText}
            onChange={(e) => setReviewResponseText(e.target.value)}
            className='font-mono text-xs'
            placeholder='response JSON（例如 invokeSkill result）'
          />
          <Button type='primary' onClick={handleReview}>
            执行评审
          </Button>
          <Input.TextArea
            rows={10}
            value={reviewResult ? JSON.stringify(reviewResult, null, 2) : ''}
            readOnly
            className='font-mono text-xs'
            placeholder='评审结果'
          />
        </Space>
      </div>

      <div className='mt-4 rounded border border-neutral-200 p-4'>
        <div className='mb-2 text-sm font-medium'>待人工确认决策</div>
        <Table<GovernanceDecision>
          rowKey='token'
          pagination={false}
          dataSource={decisions}
          columns={[
            { title: 'token', dataIndex: 'token', width: 260 },
            {
              title: 'runtimeSkillId',
              dataIndex: 'runtimeSkillId',
              width: 200,
            },
            { title: 'mode', dataIndex: 'mode', width: 110 },
            {
              title: 'issues',
              render: (_, row) => (row.issues ?? []).join(' | ') || '-',
            },
            {
              title: '操作',
              width: 180,
              render: (_, row) => (
                <Space>
                  <Button
                    size='small'
                    type='primary'
                    onClick={async () => {
                      await approveGovernanceDecision(row.token, {
                        operator: 'portal',
                      });
                      await loadDecisions();
                      message.success('已批准');
                    }}
                  >
                    通过
                  </Button>
                  <Button
                    size='small'
                    danger
                    onClick={async () => {
                      await rejectGovernanceDecision(row.token, {
                        operator: 'portal',
                      });
                      await loadDecisions();
                      message.success('已拒绝');
                    }}
                  >
                    拒绝
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={open}
        title={editing ? `编辑 ${editing.id}` : '新建治理 Skill'}
        onCancel={() => setOpen(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        width={780}
      >
        <Form layout='vertical' form={form}>
          <Form.Item label='id' name='id' rules={[{ required: true }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label='name' name='name' rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label='description' name='description'>
            <Input />
          </Form.Item>
          <Form.Item label='domain' name='domain'>
            <Input />
          </Form.Item>
          <Form.Item label='version' name='version'>
            <Input />
          </Form.Item>
          <Form.Item label='status' name='status'>
            <Input />
          </Form.Item>
          <Form.Item label='runtimeSkillIds(JSON)' name='runtimeSkillIds'>
            <Input.TextArea rows={3} className='font-mono text-xs' />
          </Form.Item>
          <Form.Item label='checklist(JSON)' name='checklist'>
            <Input.TextArea rows={6} className='font-mono text-xs' />
          </Form.Item>
          <Form.Item label='content(markdown)' name='content'>
            <Input.TextArea rows={10} className='font-mono text-xs' />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default GovernanceSkillPage;
