'use client';

import { Alert, Input } from 'antd';
import type React from 'react';

type JsonEditorProps = {
  value: string;
  onChange: (next: string) => void;
  minRows?: number;
  readOnly?: boolean;
  parseError?: string | null;
};

const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  minRows = 18,
  readOnly,
  parseError,
}) => (
  <div>
    {parseError ? (
      <Alert type="error" message={parseError} showIcon className="mb-2" />
    ) : null}
    <Input.TextArea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      spellCheck={false}
      className="font-mono text-sm"
      style={{ fontFamily: 'ui-monospace, monospace' }}
      autoSize={{ minRows }}
    />
  </div>
);

export default JsonEditor;
