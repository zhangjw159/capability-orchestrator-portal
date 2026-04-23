'use client';

import { Card, Col, Row } from 'antd';
import Link from 'next/link';
import type React from 'react';

const LegacyConsolePage: React.FC = () => (
  <Row gutter={[16, 16]}>
    <Col xs={24} md={12} lg={8}>
      <Link href='/admin/orchestrator/flows'>
        <Card hoverable title='流程定义'>
          查看与管理流程 DSL，保存草稿并发布版本。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12} lg={8}>
      <Link href='/admin/orchestrator/execute'>
        <Card hoverable title='执行调试'>
          传入参数执行流程，查看输出与 trace。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12} lg={8}>
      <Link href='/admin/orchestrator/executions'>
        <Card hoverable title='执行历史'>
          浏览执行记录与步骤明细。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12} lg={8}>
      <Link href='/admin/orchestrator/tools'>
        <Card hoverable title='工具注册'>
          查看已注册工具并刷新 MCP 工具列表。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12} lg={8}>
      <Link href='/admin/orchestrator/skills'>
        <Card hoverable title='Skill 管理'>
          管理 skill 定义并在变更后触发 reload。
        </Card>
      </Link>
    </Col>
  </Row>
);

export default LegacyConsolePage;
