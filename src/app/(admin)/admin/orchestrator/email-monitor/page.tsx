'use client';

import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Card, Descriptions, Empty, Form, Input, Space, Tag } from 'antd';
import { useCallback, useState } from 'react';

import {
  confirmEmailAnalysisResult,
  queryConfirmQuotationByEmail,
} from '@/api/orchestrator';
import type {
  ConfirmQuotaGroup,
  ConfirmQuotaItem,
  ConfirmQuotaQueryResult,
} from '@/types/orchestrator';

const EmailMonitorPage = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ email: string }>();
  const [loading, setLoading] = useState(false);
  const [confirmingKey, setConfirmingKey] = useState<string>('');
  const [result, setResult] = useState<ConfirmQuotaQueryResult>({
    groups: [],
  });

  const formatToSingaporeTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  };

  const handleSearch = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const data = await queryConfirmQuotationByEmail({
        email: values.email.trim(),
      });
      setResult(data);
      message.success(`查询成功，共 ${data.groups.length} 个待确认组`);
    } catch (error) {
      const text =
        error && typeof error === 'object' && 'data' in error
          ? String((error as { data?: { message?: string } }).data?.message ?? '')
          : String(error ?? '');
      message.error(text || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const getGroupKey = useCallback(
    (group: ConfirmQuotaGroup, index?: number) =>
      `${group.analysisResultId ?? 'analysis'}-${index ?? 0}`,
    []
  );

  const handleConfirm = useCallback(
    async (group: ConfirmQuotaGroup, index: number) => {
      const confirmActionPath = group.action?.actionPath ?? '';
      if (!confirmActionPath) {
        message.warning('当前结果未返回 ConfirmEmailAnalysisResult action path');
        return;
      }
      const email = String(form.getFieldValue('email') ?? '').trim();
      if (!email) {
        message.warning('请先输入并查询邮箱');
        return;
      }
      const groupKey = getGroupKey(group, index);
      setConfirmingKey(groupKey);
      try {
        await confirmEmailAnalysisResult(confirmActionPath, {
          email,
          analysis_result_id: group.analysisResultId,
        });
        setResult((prev) => ({
          ...prev,
          groups: prev.groups.filter((item, i) => getGroupKey(item, i) !== groupKey),
        }));
        message.success('确认成功');
      } catch (error) {
        const text =
          error && typeof error === 'object' && 'data' in error
            ? String((error as { data?: { message?: string } }).data?.message ?? '')
            : String(error ?? '');
        message.error(text || '确认失败');
      } finally {
        setConfirmingKey('');
      }
    },
    [form, getGroupKey, message]
  );

  const renderItem = (item: ConfirmQuotaItem, index: number) => (
    <Card key={`${item.orderGroupId ?? 'group'}-${item.deliveryDatetime ?? index}`} size='small'>
      <Descriptions size='small' column={2} bordered>
        <Descriptions.Item label='order_group_id'>
          {item.orderGroupId ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label='company'>{item.companyName ?? '-'}</Descriptions.Item>
        <Descriptions.Item label='service'>{item.service ?? '-'}</Descriptions.Item>
        <Descriptions.Item label='vehicle_type'>{item.vehicleType ?? '-'}</Descriptions.Item>
        <Descriptions.Item label='vehicle_count'>{item.vehicleCount ?? '-'}</Descriptions.Item>
        <Descriptions.Item label='rental_days'>{item.rentalDays ?? '-'}</Descriptions.Item>
        <Descriptions.Item label='delivery_datetime'>
          {formatToSingaporeTime(item.deliveryDatetime)}
        </Descriptions.Item>
        <Descriptions.Item label='collection_datetime'>
          {formatToSingaporeTime(item.collectionDatetime)}
        </Descriptions.Item>
        <Descriptions.Item label='daily_rate'>{item.dailyRateText ?? '-'}</Descriptions.Item>
        <Descriptions.Item label='estimated_total_before_gst'>
          {item.estimatedTotalBeforeGstText ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label='delivery_location' span={2}>
          {item.deliveryLocation ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label='collection_location' span={2}>
          {item.collectionLocation ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label='matched_catalog' span={2}>
          {item.matchedCatalog ? (
            <Space wrap>
              <Tag color='blue'>{item.matchedCatalog.itemId ?? '-'}</Tag>
              <span>{item.matchedCatalog.matchReason ?? '-'}</span>
            </Space>
          ) : (
            '-'
          )}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );

  return (
    <PageContainer title='Email Monitor - Confirm Quotation'>
      <div className='mb-4 rounded border border-neutral-200 p-4'>
        <Form
          form={form}
          layout='inline'
          initialValues={{ email: '' }}
          onFinish={() => void handleSearch()}
        >
          <Form.Item
            name='email'
            label='Email'
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input
              style={{ width: 320 }}
              placeholder='例如 perlyn@lylo.sg'
              allowClear
            />
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit' loading={loading}>
              查询待确认报价
            </Button>
          </Form.Item>
        </Form>
      </div>

      {result.groups.length === 0 ? (
        <Empty description='暂无待确认组' />
      ) : (
        <Space direction='vertical' size={16} className='w-full'>
          {result.groups.map((group, groupIndex) => {
            const groupKey = getGroupKey(group, groupIndex);
            return (
              <Card
                key={groupKey}
                title={`确认组 ${groupIndex + 1}`}
                extra={
                  <Button
                    type='primary'
                    disabled={!group.action?.actionPath}
                    loading={confirmingKey === groupKey}
                    onClick={() => void handleConfirm(group, groupIndex)}
                  >
                    确认本组
                  </Button>
                }
              >
                <div className='mb-3 text-xs text-neutral-500'>
                  analysis_result_id: {group.analysisResultId ?? '-'}；action:
                  {group.action?.actionName ?? '-'} ({group.action?.actionPath ?? '-'})
                </div>
                <Space direction='vertical' size={12} className='w-full'>
                  {group.items.map((item, itemIndex) => renderItem(item, itemIndex))}
                </Space>
              </Card>
            );
          })}
        </Space>
      )}
    </PageContainer>
  );
};

export default EmailMonitorPage;
