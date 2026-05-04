'use client';

import { PageContainer } from '@ant-design/pro-components';
import { ExportOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Typography } from 'antd';
import { useMemo, type FC } from 'react';

import { BASE_API_URL_EXPORT } from '@/base/api/request';

function buildOpenAPIImportUrl(): string {
  const base = (BASE_API_URL_EXPORT || '').trim().replace(/\/$/, '');
  if (!base) {
    return '';
  }
  return `${base}/openapi-import/`;
}

const OpenAPIImportPage: FC = () => {
  const src = useMemo(() => buildOpenAPIImportUrl(), []);

  if (!src) {
    return (
      <PageContainer header={{ title: 'OpenAPI → MCP 导入' }}>
        <Alert
          type='warning'
          showIcon
          message='未配置 NEXT_PUBLIC_BASE_API_URL'
          description='请在环境变量中设置编排服务 API 根地址（例如本地 http://127.0.0.1:8050），与 .env.sit 中一致，保存后重启 Portal。'
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer header={{ title: 'OpenAPI → MCP 导入' }}>
      <Typography.Paragraph type='secondary' style={{ marginBottom: 16 }}>
        解析 OpenAPI 文档并注册为 MCP 工具；内嵌编排服务地址{' '}
        <Typography.Text code>{BASE_API_URL_EXPORT}</Typography.Text> 下的静态导入页。
      </Typography.Paragraph>
      <Alert
        type='info'
        showIcon
        style={{ marginBottom: 16 }}
        message='注册成功后，MCP 客户端在 tools/list 中可见新工具；调用时由编排服务拼装请求并发往真实业务 API。'
      />
      <Space style={{ marginBottom: 12 }}>
        <Button
          type='primary'
          icon={<ExportOutlined />}
          href={src}
          target='_blank'
          rel='noreferrer'
        >
          新标签打开导入页
        </Button>
      </Space>
      <div
        style={{
          height: 'calc(100vh - 280px)',
          minHeight: 480,
          border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <iframe
          title='OpenAPI MCP 导入'
          src={src}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    </PageContainer>
  );
};

export default OpenAPIImportPage;
