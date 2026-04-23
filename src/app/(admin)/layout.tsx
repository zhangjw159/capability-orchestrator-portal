'use client';

import { ProLayout } from '@ant-design/pro-components';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';

const route = {
  routes: [
    { path: '/admin', name: 'Dashboard' },
    { path: '/admin/demo', name: 'Demo' },
    { path: '/admin/orchestrator', name: '流程编排' },
    { path: '/admin/orchestrator/studio', name: 'Studio Console' },
    { path: '/admin/orchestrator/legacy', name: 'Legacy Flow Console' },
    { path: '/admin/orchestrator/flows', name: '流程定义' },
    { path: '/admin/orchestrator/execute', name: '执行调试' },
    { path: '/admin/orchestrator/executions', name: '执行历史' },
    { path: '/admin/orchestrator/tools', name: '工具注册' },
  ],
};

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  return (
    <ProLayout
      style={{ minHeight: '100vh' }}
      token={{
        header: { colorBgHeader: 'white' },
        sider: {
          colorMenuBackground: 'white',
          colorTextMenu: '#171725',
          colorTextMenuSelected: '#1677FF',
          colorBgMenuItemSelected: '#E6F4FF',
        },
        pageContainer: {
          paddingBlockPageContainerContent: 24,
          paddingInlinePageContainerContent: 24,
        },
      }}
      route={route}
      location={{ pathname: pathname || '/' }}
      menuItemRender={(item, dom) =>
        item.path ? <Link href={item.path}>{dom}</Link> : dom
      }
    >
      {children}
    </ProLayout>
  );
};

export default AdminLayout;
