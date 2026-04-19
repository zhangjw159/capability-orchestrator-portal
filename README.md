# FE Framework

基于 Next.js 14 + Ant Design 5 + Pro Components 的前端管理后台骨架，从 lylo-concierge-admin 抽离的通用框架。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **UI**: Ant Design 5 + @ant-design/pro-components
- **样式**: Tailwind CSS 4
- **状态**: Redux Toolkit + React Query
- **代码规范**: Biome (lint + format)
- **请求**: Axios 封装（统一 header、401 跳转、取消请求）

## 目录结构

```
src/
├── app/                 # Next.js App Router
│   ├── (admin)/         # 管理后台路由组
│   │   ├── layout.tsx   # ProLayout 侧栏布局
│   │   └── admin/       # /admin, /admin/demo
│   ├── layout.tsx       # 根布局（Provider 链）
│   ├── globals.css
│   └── theme.ts         # Antd 主题
├── base/                # 基础层
│   ├── api/             # request 封装
│   ├── constant/         # 常量（如 ACCESS_TOKEN）
│   ├── hook/             # 全局 hooks（如 stateful-api）
│   ├── lib/              # AntdRegistry 等
│   └── state/            # Redux store + slice
└── common/              # 通用业务
    └── pro-components/   # Pro 组件 valueTypeMap
```

## 运行

```bash
pnpm install
pnpm dev          # 需选择环境，依赖 .env.sit / .env.uat / .env.prod
# 或直接指定环境
env-cmd -f .env.sit next dev -p 4000
```

## 构建

```bash
pnpm build
pnpm build:sit    # env-cmd -f .env.sit next build
pnpm build:uat
pnpm build:prod
```

## 环境变量

复制 `.env.example` 为 `.env.sit` / `.env.uat` / `.env.prod`，并填写：

- `NEXT_PUBLIC_BASE_API_URL`：后端 API 基础地址（必填，否则请求 baseURL 为 `/`）

## 扩展

- **新业务路由**：在 `src/app/(admin)/admin/` 下新建目录，如 `quotation/page.tsx` → `/admin/quotation`
- **菜单**：在 `(admin)/layout.tsx` 的 `route.routes` 中增加项并指向对应 path
- **请求**：使用 `@/base/api/request` 的 `request.get/post/put/delete`，会自动带 token 与 Trace-ID
- **全局状态**：使用 `@/base/state` 的 `useGlobalState(path, initialData)`
