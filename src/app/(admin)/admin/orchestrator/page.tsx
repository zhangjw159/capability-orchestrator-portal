'use client';

import { Card, Col, Row } from 'antd';
import Link from 'next/link';
import type React from 'react';

const OrchestratorHome: React.FC = () => (
  <Row gutter={[16, 16]}>
    <Col xs={24} md={12}>
      <Link href='/admin/orchestrator/studio'>
        <Card hoverable title='Studio Console（新主线）'>
          Route B：以 assistant / thread / run 为中心，面向 LangGraph Studio
          原生工作流调试。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12}>
      <Link href='/admin/orchestrator/legacy'>
        <Card hoverable title='Legacy Flow Console（兼容入口）'>
          Route A：保留 Flow DSL 的流程定义、可视化编辑、执行调试与工具管理。
        </Card>
      </Link>
    </Col>
  </Row>
);

export default OrchestratorHome;
