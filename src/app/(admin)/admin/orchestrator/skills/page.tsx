'use client';

import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Form, Input, Modal, Space, Switch, Table, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  createSkill,
  listSkills,
  reloadSkills,
  updateSkill,
  updateSkillStatus,
} from '@/api/orchestrator';
import type { OrchestratorSkill } from '@/types/orchestrator';

const SkillPage = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<OrchestratorSkill[]>([]);
  const [editing, setEditing] = useState<OrchestratorSkill | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ skillId: '', name: '', definition: '{}' });
    setOpen(true);
  };

  const openEdit = (row: OrchestratorSkill) => {
    setEditing(row);
    form.setFieldsValue({
      skillId: row.skillId,
      name: row.name,
      definition: JSON.stringify(row.definition ?? {}, null, 2),
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    let definitionObj: Record<string, unknown> = {};
    try {
      definitionObj = JSON.parse(values.definition || '{}') as Record<string, unknown>;
    } catch {
      message.error('definition 必须是合法 JSON');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateSkill(editing.skillId, { name: values.name, definition: definitionObj });
      } else {
        await createSkill({ skillId: values.skillId, name: values.name, definition: definitionObj });
      }
      await reloadSkills();
      await load();
      message.success('Skill 保存成功并已 reload');
      setOpen(false);
    } catch (error) {
      const text = String(error ?? '');
      if (text.includes('skill.id cannot be changed')) {
        message.error('skill ID 不可修改，请新建 skill');
      } else {
        message.error('保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer
      title="Skill 管理"
      extra={[
        <Button key="reload" onClick={async () => {
          await reloadSkills();
          await load();
          message.success('已 reload');
        }}>
          手动 reload
        </Button>,
        <Button key="new" type="primary" onClick={openCreate}>
          新建 Skill
        </Button>,
      ]}
    >
      <Table<OrchestratorSkill>
        rowKey="skillId"
        loading={loading}
        dataSource={skills}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: 'skill_id', dataIndex: 'skillId', width: 260 },
          { title: 'name', dataIndex: 'name' },
          {
            title: 'status',
            dataIndex: 'status',
            render: (value) => <Tag color={value === 'enabled' ? 'green' : 'default'}>{String(value ?? '-')}</Tag>,
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
                  await updateSkillStatus(row.skillId, checked ? 'enabled' : 'disabled');
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
                <Button type="link" onClick={() => openEdit(row)}>
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
        <Form layout="vertical" form={form}>
          <Form.Item
            label="skillId"
            name="skillId"
            rules={[{ required: true, message: '请输入 skillId' }]}
          >
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item label="name" name="name">
            <Input />
          </Form.Item>
          <Form.Item label="definition(JSON)" name="definition">
            <Input.TextArea rows={12} className="font-mono text-xs" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default SkillPage;
