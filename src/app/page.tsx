'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">FE Framework</h1>
      <p className="text-gray-600">
        Next.js 14 + Ant Design Pro + Tailwind + Redux Toolkit
      </p>
      <Link
        href="/admin/orchestrator"
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        进入流程编排
      </Link>
    </div>
  );
}
