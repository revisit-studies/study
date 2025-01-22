import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import * as toml from 'toml'; // 导入整个 toml 库

// 注册 TOML 语言
monaco.languages.register({ id: 'toml' });
monaco.languages.setMonarchTokensProvider('toml', {
  tokenizer: {
    root: [
      [/".*?"/, 'string'], // 字符串
      [/[-+]?[0-9]+(\.[0-9]+)?/, 'number'], // 数字
      [/(true|false)/, 'keyword'], // 布尔值
      [/\[.*?\]/, 'namespace'], // 表格头
      [/^[a-zA-Z0-9_-]+(?=\s*=)/, 'key'], // 键名
    ],
  },
});

// 自定义 hc-black 主题
monaco.editor.defineTheme('hc-black', {
  base: 'hc-black',
  inherit: true,
  rules: [
    { token: 'string', foreground: 'ce9178' },
    { token: 'number', foreground: 'b5cea8' },
    { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
    { token: 'namespace', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'key', foreground: 'dcdcaa', fontStyle: 'italic' },
  ],
  colors: {
    'editor.foreground': '#ffffff', // 默认前景色
    'editor.background': '#000000', // 背景色
    'editor.lineHighlightBackground': '#333333', // 当前行高亮背景
    'editorCursor.foreground': '#ffffff', // 光标颜色
    'editor.selectionBackground': '#264f78', // 选择背景
    'editorLineNumber.foreground': '#858585', // 行号颜色
  },
});

interface EditorAnswer {
  status: boolean;
  answers: {
    code: string;
    error: string;
  };
}

interface StimulusParamsTyped {
  setAnswer: (answer: EditorAnswer) => void;
}

function useTomlEditor(initialCode: string) {
  const [code, setCode] = useState(initialCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateToml = useCallback((currentCode: string) => {
    let validationErrors: string[] = [];
    if (!editorInstance) return currentErrors;

    try {
      toml.parse(currentCode);
      validationErrors = ['No errors found. TOML is valid!'];
      monaco.editor.setModelMarkers(editorInstance.getModel()!, 'toml', []);
    } catch (e) {
      if (e instanceof Error && e.message) {
        const match = /at line (\\d+), column (\\d+)/.exec(e.message);
        if (match) {
          const lineNumber = parseInt(match[1], 10);
          const startColumn = parseInt(match[2], 10);

          validationErrors = [`Syntax error at line ${lineNumber}, column ${startColumn}: ${e.message}`];

          monaco.editor.setModelMarkers(editorInstance.getModel()!, 'toml', [
            {
              startLineNumber: lineNumber,
              startColumn,
              endLineNumber: lineNumber,
              endColumn: startColumn + 1,
              message: e.message,
              severity: monaco.MarkerSeverity.Error,
            },
          ]);
        } else {
          validationErrors = [e.message];
        }
      }
    }

    setCurrentErrors(validationErrors);
    return validationErrors;
  }, [editorInstance, currentErrors]);

  return {
    code,
    setCode,
    currentErrors,
    validateToml,
    setEditorInstance,
  };
}

function CodeEditorTest({ setAnswer }: StimulusParamsTyped): React.ReactElement {
  const {
    code,
    setCode,
    currentErrors,
    validateToml,
    setEditorInstance,
  } = useTomlEditor('');

  useEffect(() => {
    const latestErrors = validateToml(code);

    setAnswer({
      status: true,
      answers: {
        code,
        error: latestErrors.join('\\n'),
      },
    });
  }, [code, validateToml, setAnswer]);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'toml',
        theme: 'hc-black', // 使用 hc-black 主题
        automaticLayout: true,
        minimap: { enabled: false },
        formatOnPaste: true,
        formatOnType: true,
        scrollBeyondLastLine: false,
      });

      setEditorInstance(editor);

      editor.onDidChangeModelContent(() => {
        const rawCode = editor.getValue();
        setCode(rawCode);
      });

      return () => {
        editor.dispose();
      };
    }
    return undefined;
  }, [setCode, setEditorInstance]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '20px',
    }}
    >
      {/* fig and code editor */}
      <div style={{ display: 'flex', width: '100%', gap: '20px' }}>
        <div style={{ flex: '0 0 60%' }}>
          <img
            src="./assets/tasks/fig/config_write.png"
            alt="Example"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </div>

        <Box
          style={{
            flex: '0 0 40%',
            height: '500px',
            border: '1px solid #ccc',
            borderRadius: '8px',
          }}
          ref={containerRef}
        />
      </div>

      {/* validation */}
      <Box
        style={{
          background: '#f5f5f5',
          padding: '10px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
        }}
      >
        <h3>Validation Status:</h3>
        <ul>
          {currentErrors.map((error, index) => (
            <li key={index} style={{ color: error.includes('valid') ? 'green' : 'red' }}>
              {error}
            </li>
          ))}
        </ul>
      </Box>
    </div>
  );
}

export default CodeEditorTest;
