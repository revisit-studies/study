import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import TOML from '@ltd/j-toml';

function useTomlEditor(initialCode: string) {
  const [code, setCode] = useState(initialCode);
  const [errors, setErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateToml = useCallback(() => {
    if (!editorInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;

    try {
      // 使用简化的解析配置
      TOML.parse(code, 1.0);
      setErrors(['No errors found. TOML is valid!']);
      monaco.editor.setModelMarkers(model, 'toml', []);
    } catch (e) {
      if (e instanceof Error) {
        setErrors([e.message]);

        // 提取错误位置信息
        const lineMatch = e.message.match(/line\s+(\d+)/i);
        const columnMatch = e.message.match(/column\s+(\d+)/i);
        
        const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : 1;
        const column = columnMatch ? parseInt(columnMatch[1], 10) : 1;

        // 设置错误标记
        monaco.editor.setModelMarkers(model, 'toml', [{
          startLineNumber: lineNumber,
          startColumn: column,
          endLineNumber: lineNumber,
          endColumn: model.getLineLength(lineNumber) + 1,
          message: e.message,
          severity: monaco.MarkerSeverity.Error,
        }]);
      }
    }
  }, [code, editorInstance]);

  return { code, setCode, errors, validateToml, setEditorInstance };
}

function TomlEditorTest(): React.ReactElement {
  const { code, setCode, errors, validateToml, setEditorInstance } = useTomlEditor('');

  useEffect(() => {
    // 注册 TOML 语言
    monaco.languages.register({ id: 'toml' });

    // 设置 TOML 的语言配置
    monaco.languages.setMonarchTokensProvider('toml', {
      tokenizer: {
        root: [
          // 注释
          [/#.*$/, 'comment'],

          // 表格和数组表格
          [/^\s*\[\[.*?\]\]/, 'metatag'],  // 数组表格
          [/^\s*\[.*?\]/, 'metatag'],      // 普通表格

          // 键值对
          [/([A-Za-z_][A-Za-z0-9_\-]*)(?=\s*=)/, 'type'],  // 键名
          [/=/, 'operators'],                               // 等号

          // 字符串
          [/"([^"\\]|\\.)*"/, 'string'],       // 基本字符串
          [/'([^'\\]|\\.)*'/, 'string'],       // 字面字符串
          [/"""/, 'string', '@multiString'],    // 多行基本字符串
          [/'''/, 'string', '@multiLiteral'],   // 多行字面字符串

          // 数字
          [/[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/, 'number'],  // 整数和浮点数
          [/0x[0-9a-fA-F]+/, 'number'],                             // 十六进制
          [/0o[0-7]+/, 'number'],                                   // 八进制
          [/0b[01]+/, 'number'],                                    // 二进制

          // 布尔值
          [/\b(true|false)\b/, 'keyword'],

          // 日期和时间
          [/\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?/, 'string.date'],
          
          // 数组
          [/\[|\]/, 'operators'],
          [/,/, 'operators'],
        ],

        multiString: [
          [/"""/, 'string', '@pop'],
          [/.+/, 'string']
        ],

        multiLiteral: [
          [/'''/, 'string', '@pop'],
          [/.+/, 'string']
        ],
      }
    });

    // 配置语言特性
    monaco.languages.setLanguageConfiguration('toml', {
      comments: {
        lineComment: '#'
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: '"""', close: '"""' },
        { open: '\'\'\'', close: '\'\'\'' }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' }
      ]
    });
  }, []);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'toml',
        theme: 'hc-black',    // 使用高对比度主题
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
          onClick={validateToml}
          style={{
            padding: '10px 20px',
            borderRadius: '4px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Validate TOML
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
                color: error === 'No errors found. TOML is valid!' ? 'green' : 'red'
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

export default TomlEditorTest;