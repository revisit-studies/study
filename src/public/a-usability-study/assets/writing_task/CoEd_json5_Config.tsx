import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import JSON5 from 'json5';

function useJson5Editor(initialCode: string) {
  const [code, setCode] = useState(initialCode);
  const [errors, setErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateJson5 = useCallback(() => {
    if (!editorInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;

    try {
      JSON5.parse(code);
      setErrors(['No errors found. JSON5 is valid!']);
      monaco.editor.setModelMarkers(model, 'json5', []);
    } catch (e) {
      if (e instanceof Error) {
        setErrors([e.message]);

        // 提取错误位置信息
        const match = e.message.match(/at position (\d+)/i);
        let errorLine = 1;
        let errorColumn = 1;

        if (match) {
          const position = parseInt(match[1], 10);
          const codeUntilError = code.substring(0, position);
          const lines = codeUntilError.split('\n');
          errorLine = lines.length;
          errorColumn = lines[lines.length - 1].length + 1;
        }

        // 设置错误标记
        monaco.editor.setModelMarkers(model, 'json5', [{
          startLineNumber: errorLine,
          startColumn: errorColumn,
          endLineNumber: errorLine,
          endColumn: model.getLineLength(errorLine) + 1,
          message: e.message,
          severity: monaco.MarkerSeverity.Error,
        }]);
      }
    }
  }, [code, editorInstance]);

  return { code, setCode, errors, validateJson5, setEditorInstance };
}

function Json5EditorTest(): React.ReactElement {
  const { code, setCode, errors, validateJson5, setEditorInstance } = useJson5Editor('');

  useEffect(() => {
    // 注册 JSON5 语言
    monaco.languages.register({ id: 'json5' });

    // 设置 JSON5 的语言配置
    monaco.languages.setMonarchTokensProvider('json5', {
      tokenizer: {
        root: [
          // 注释
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],

          // 键名（支持无引号标识符）
          [/[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*:)/, 'string.key'],
          [/"([^"]*)"(?=\s*:)/, 'string.key'],
          [/'([^']*)'(?=\s*:)/, 'string.key'],

          // 字符串值
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*'/, 'string'],

          // 数字（包括十六进制和科学记数法）
          [/-?\b(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?\b/, 'number'],
          [/\b0[xX][0-9a-fA-F]+\b/, 'number.hex'],
          [/\b(?:Infinity|NaN)\b/, 'number'],

          // 布尔值和 null
          [/\b(?:true|false|null)\b/, 'keyword'],

          // 分隔符
          [/[{}\[\],:]/, 'delimiter'],

          // 运算符
          [/[+\-]/, 'operator'],
        ],

        comment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment']
        ]
      }
    });

    // 配置语言特性
    monaco.languages.setLanguageConfiguration('json5', {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['{', '}'],
        ['[', ']']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' }
      ]
    });
  }, []);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'json5',
        theme: 'hc-black',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderValidationDecorations: 'on',
        formatOnPaste: true,
        formatOnType: true,
        wordWrap: 'on',
        lineNumbers: 'on',
        glyphMargin: true,
        folding: true,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 3,
      });

      setEditorInstance(editor);

      editor.onDidChangeModelContent(() => {
        const rawCode = editor.getValue();
        setCode(rawCode);
      });

      return () => editor.dispose();
    }
  }, [setCode, setEditorInstance]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px',
    }}>
      <div style={{ display: 'flex', width: '100%', gap: '20px' }}>
        <div style={{ flex: '0 0 60%' }}>
          <img
            src="/a-usability-study/assets/tasks/fig/config_write.png"
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

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          onClick={validateJson5}
          style={{
            padding: '10px 20px',
            borderRadius: '4px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Validate JSON5
        </button>
      </div>

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
        <h3>Validation Results:</h3>
        {errors.length > 0 ? (
          <ul>
            {errors.map((error, index) => (
              <li key={index} style={{ 
                color: error === 'No errors found. JSON5 is valid!' ? 'green' : 'red'
              }}>
                {error}
              </li>
            ))}
          </ul>
        ) : (
          <p>No errors found.</p>
        )}
      </Box>
    </div>
  );
}

export default Json5EditorTest;