'use client';

import { Card, Col, Row } from 'antd';
import Link from 'next/link';
import type React from 'react';

const OrchestratorHome: React.FC = () => (
  <Row gutter={[16, 16]}>
    <Col xs={24} md={12}>
      <Link href='/admin/orchestrator/flows'>
        <Card hoverable title='Flow Studio（主线）'>
          Skill + Flow + Temporal 主链路：流程定义、可视化编排、版本管理与发布。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12}>
      <Link href='/admin/orchestrator/executions'>
        <Card hoverable title='Run Console（主线）'>
          执行历史、Trace 排障、运行态观察。面向生产执行闭环。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12}>
      <Link href='/admin/orchestrator/skills'>
        <Card hoverable title='Skill Center（主线）'>
          Skill Registry 管理与 invoke 联调。MCP Tool 作为底层实现能力。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12}>
      <Link href='/admin/orchestrator/governance-skills'>
        <Card hoverable title='Governance Skills（治理）'>
          业务规则/验收清单/隔离边界管理，关联 Runtime Skills 做执行前后评审。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12}>
      <Link href='/admin/orchestrator/governance-reports'>
        <Card hoverable title='Governance Reports（审计）'>
          治理校验通过率、阻断次数、issue 聚合，支持按 flowId 过滤。
        </Card>
      </Link>
    </Col>
    <Col xs={24} md={12}>
      <Link href='/admin/orchestrator/studio'>
        <Card hoverable title='AI Planner Console（辅助）'>
          LangGraph 仅用于 Planner / Flow Generator / Skill
          Recommender，不作为运行时主模型。
        </Card>
      </Link>
    </Col>
  </Row>
);

export default OrchestratorHome;
