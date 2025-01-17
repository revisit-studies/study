import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import yaml from 'js-yaml';

function useYamlEditor(initialCode: string) {
  const [code, setCode] = useState(initialCode);
  const [errors, setErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateYaml = useCallback(() => {
    if (!editorInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;

    try {
      yaml.load(code);
      setErrors(['No errors found. YAML is valid!']);
      monaco.editor.setModelMarkers(model, 'yaml', []);
    } catch (e) {
      if (e instanceof yaml.YAMLException) {
        const errorMessage = e.message;
        setErrors([errorMessage]);

        // YAML 错误通常包含行号信息
        const lineMatch = e.mark?.line !== undefined ? e.mark.line + 1 : 1;
        const columnMatch = e.mark?.column !== undefined ? e.mark.column + 1 : 1;

        monaco.editor.setModelMarkers(model, 'yaml', [{
          startLineNumber: lineMatch,
          startColumn: columnMatch,
          endLineNumber: lineMatch,
          endColumn: model.getLineLength(lineMatch) + 1,
          message: errorMessage,
          severity: monaco.MarkerSeverity.Error,
        }]);
      }
    }
  }, [code, editorInstance]);

  return { code, setCode, errors, validateYaml, setEditorInstance };
}

function YamlEditorTest(): React.ReactElement {
  const { code, setCode, errors, validateYaml, setEditorInstance } = useYamlEditor('');

  useEffect(() => {
    // 注册 YAML 语言
    monaco.languages.register({ id: 'yaml' });

    // 设置 YAML 的语言配置
    monaco.languages.setMonarchTokensProvider('yaml', {
      tokenizer: {
        root: [
          // 注释
          [/#.*$/, 'comment'],

          // 键值对
          [/([^:]+?)(?=\s*:)/, 'type'],  // 键名
          [/:/, 'operators'],             // 冒号

          // 特殊值
          [/\b(true|false|null|undefined)\b/, 'keyword'],
          [/[+-]?[0-9]+\.?[0-9]*/, 'number'],
          
          // 字符串（引号可选）
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'([^'\\]|\\.)*'/, 'string'],

          // 特殊 YAML 语法
          [/^---/, 'operators'],          // 文档开始
          [/^\.{3}/, 'operators'],        // 文档结束
          [/\|/, 'operators'],            // 多行字符串
          [/>/, 'operators'],             // 折叠多行字符串
          
          // 数组
          [/^(\s*)-/, 'operators'],       // 数组项

          // 引用和锚点
          [/&\w+/, 'tag'],               // 锚点
          [/\*\w+/, 'tag'],              // 引用
        ],
      }
    });

    // 配置语言特性
    monaco.languages.setLanguageConfiguration('yaml', {
      comments: {
        lineComment: '#'
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
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
      ],
      indentationRules: {
        increaseIndentPattern: /^.*:(?:$|[^:]*[^-\s]$)|^\s*-\s*[^-\s]/,
        decreaseIndentPattern: /^\s*-\s*[^-\s]|^\s+\}$|^\s+\]$/
      }
    });
  }, []);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'yaml',
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
        tabSize: 2,
        insertSpaces: true,
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
          onClick={validateYaml}
          style={{
            padding: '10px 20px',
            borderRadius: '4px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Validate YAML
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
                color: error === 'No errors found. YAML is valid!' ? 'green' : 'red'
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

export default YamlEditorTest;