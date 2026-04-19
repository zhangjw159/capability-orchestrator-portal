'use client';

import { ProConfigProvider } from '@ant-design/pro-components';
import NiceModal from '@ebay/nice-modal-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configResponsive } from 'ahooks';
import { App, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import { Roboto } from 'next/font/google';
import type React from 'react';

import { GlobalStateProvider } from '@/base/state';
import valueTypeMap from '@/common/pro-components';
import StyledComponentsRegistry from '@/base/lib/AntdRegistry';
import theme from './theme';

import './globals.css';

configResponsive({
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
});

export const roboto = Roboto({
  weight: ['100', '300', '400', '500', '700', '900'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
});

const queryClient = new QueryClient();

const RootLayout = ({ children }: React.PropsWithChildren) => (
  <html lang="en">
    <head>
      <meta name="robots" content="noindex, nofollow" />
    </head>
    <body className={roboto.className}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider locale={enUS} theme={theme}>
          <StyledComponentsRegistry>
            <GlobalStateProvider>
              <ProConfigProvider valueTypeMap={valueTypeMap}>
                <NiceModal.Provider>
                  <App>{children}</App>
                </NiceModal.Provider>
              </ProConfigProvider>
            </GlobalStateProvider>
          </StyledComponentsRegistry>
        </ConfigProvider>
      </QueryClientProvider>
    </body>
  </html>
);

export default RootLayout;
