import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import { parse as parseHjson } from 'hjson';

function useHjsonEditor(initialCode: string) {
  const [code, setCode] = useState(initialCode);
  const [errors, setErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateHjson = useCallback(() => {
    if (!editorInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;

    try {
      // 使用 Hjson 解析，添加更宽松的解析选项
      parseHjson(code, { keepWsc: true, separator: true });
      setErrors(['No errors found. HJSON is valid!']);
      monaco.editor.setModelMarkers(model, 'hjson', []);
    } catch (e) {
      if (e instanceof Error) {
        setErrors([e.message]);
        // 尝试从错误消息中提取行号
        const lineMatch = e.message.match(/line\s+(\d+)/i);
        let errorLine = 1;

        if (lineMatch) {
          errorLine = parseInt(lineMatch[1], 10);
        } else {
          // 如果没有直接找到行号，尝试通过错误位置计算
          const posMatch = e.message.match(/at\s+position\s+(\d+)/i);
          if (posMatch) {
            const pos = parseInt(posMatch[1], 10);
            const textBeforeError = code.substring(0, pos);
            errorLine = textBeforeError.split('\n').length;
          }
        }

        // 设置错误标记
        monaco.editor.setModelMarkers(model, 'hjson', [{
          startLineNumber: errorLine,
          startColumn: 1,
          endLineNumber: errorLine,
          endColumn: model.getLineLength(errorLine) + 1,
          message: e.message,
          severity: monaco.MarkerSeverity.Error,
        }]);
      }
    }
  }, [code, editorInstance]);

  return {
    code, setCode, errors, validateHjson, setEditorInstance,
  };
}

function HjsonEditorTest(): React.ReactElement {
  const {
    code, setCode, errors, validateHjson, setEditorInstance,
  } = useHjsonEditor('');

  useEffect(() => {
    // 注册 HJSON 语言
    monaco.languages.register({ id: 'hjson' });

    // 设置 HJSON 的语言配置
    monaco.languages.setMonarchTokensProvider('hjson', {
      defaultToken: '',
      tokenPostfix: '.hjson',

      // 转义字符
      escapes: /\\(?:[bfnrtv\\"']|u[0-9A-Fa-f]{4})/,

      tokenizer: {
        root: [
          // 标识符和关键字
          [/[a-zA-Z_$][\w$]*/, {
            cases: {
              '@default': 'identifier',
            },
          }],

          // 空格
          [/[ \t\r\n]+/, ''],

          // 注释
          [/#.*$/, 'comment'],
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],

          // 数字
          [/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],

          // 分隔符
          [/[{}\[\],:]/, 'delimiter'],

          // 字符串
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string_double'],
          [/'/, 'string', '@string_single'],
          [/'''/, 'string', '@string_multiline'],

          // 键值对中的键
          [/([a-zA-Z_$][\w$]*)(?=\s*:)/, 'string.key'],
          [/"([^"]*)"(?=\s*:)/, 'string.key'],
          [/'([^']*)'(?=\s*:)/, 'string.key'],
        ],

        comment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment'],
        ],

        string_double: [
          [/[^\\"]+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/"/, 'string', '@pop'],
        ],

        string_single: [
          [/[^\\']+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/'/, 'string', '@pop'],
        ],

        string_multiline: [
          [/[^\\']+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/'''/, 'string', '@pop'],
          [/./, 'string'],
        ],
      },
    });

    // 配置语言特性
    monaco.languages.setLanguageConfiguration('hjson', {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/'],
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
      ],
    });
  }, []);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'hjson',
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
    }}
    >
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
          onClick={validateHjson}
          style={{
            padding: '10px 20px',
            borderRadius: '4px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Validate HJSON
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
              <li
                key={index}
                style={{
                  color: error === 'No errors found. HJSON is valid!' ? 'green' : 'red',
                }}
              >
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

export default HjsonEditorTest;
