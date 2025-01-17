import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import jsonlint from 'jsonlint-mod';

const initialCode = JSON.stringify(
  {
    name: 'd3-hierarchy',
    version: '3.1.2',
    description: 'Layout algorithms for visualizing hierarchical data.',
    homepage: 'https://d3js.org/d3-hierarchy/',
    repository: {
      type: 'git',
      url: 'https://github.com/d3/d3-hierarchy.git',
    },
    keywords: [
      'd3',
      'd3-module',
      'layout',
      'tree',
      'treemap',
      'hierarchy',
      'infovis',
    ],
    license: 'ISC',
    author: {
      name: 'Mike Bostock',
      url: 'http://bost.ocks.org/mike',
    },
    type: 'module',
    files: ['dist/**/*.js', 'src/**/*.js'],
    module: 'src/index.js',
    main: 'src/index.js',
    jsdelivr: 'dist/d3-hierarchy.min.js',
    unpkg: 'dist/d3-hierarchy.min.js',
    exports: {
      umd: './dist/d3-hierarchy.min.js',
      default: './src/index.js',
    },
    sideEffects: false,
    devDependencies: {
      benchmark: '2',
      'd3-array': '1.2.0 - 3',
      'd3-dsv': '1 - 3',
      'd3-random': '1.1.0 - 3',
      eslint: '8',
      mocha: '9',
      rollup: '2',
      'rollup-plugin-terser': '7',
    },
    scripts: {
      test: "mocha 'test/**/*-test.js' && eslint src test",
      prepublishOnly: 'rm -rf dist && yarn test && rollup -c',
      postpublish:
        'git push && git push --tags && cd ../d3.github.com && git pull && cp ../package_name/dist/package_name.js package_name.v1.js && cp ../package_name/dist/package_name.min.js package_name.v1.min.js && git add package_name.v1.js package_name.v1.min.js && git commit -m "package_name v1" && git push && cd -',
    },
    engines: {
      node: '>=12',
    },
  },
  null,
  2,
);

function CodeEditorTest(): React.ReactElement {
  const [code, setCode] = useState(initialCode);
  const [errors, setErrors] = useState<string[]>([]);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  // 添加自定义错误样式
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .errorDecoration {
        border-bottom: 2px wavy #ff0000;
        background-color: rgba(255, 0, 0, 0.2);
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      editor?.dispose();
      styleElement.remove();
    };
  }, [editor]);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node && !editor) {
      // 配置 Monaco 编辑器的 JSON 语言支持
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemaValidation: 'warning',
      });

      const instance = monaco.editor.create(node, {
        value: code,
        language: 'json',
        theme: 'hc-black',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        folding: true,
        lineNumbers: 'on',
        renderValidationDecorations: 'on',
      });
      setEditor(instance);

      instance.onDidChangeModelContent(() => {
        setCode(instance.getValue());
      });
    }
  }, [editor, code]);

  // 在编辑器初始化时添加错误装饰器的支持
  useEffect(() => {
    if (editor) {
      // 添加自定义样式
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .errorLine {
          background-color: rgba(255, 0, 0, 0.2) !important;
          border-radius: 3px;
        }
        .monaco-editor .errorDecoration {
          background: none !important;
          border: none !important;
          border-bottom: 4px wavy #ff3333 !important;
          margin-bottom: 4px;
          box-sizing: border-box;
        }
      `;
      document.head.appendChild(styleElement);

      return () => {
        styleElement.remove();
        editor.dispose();
      };
    }
  }, [editor]);

  const validateCode = useCallback(() => {
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    try {
      jsonlint.parse(code);
      setErrors([]);
      // 清除所有装饰器
      editor.deltaDecorations([], []);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErrors([e.message]);

        // 提取行和列号
        const match = e.message.match(/line (\d+)/i);
        const lineNumber = match ? parseInt(match[1], 10) : 1;

        // 获取错误行的内容
        const lineContent = model.getLineContent(lineNumber);

        // 创建装饰器
        const decorations = [
          {
            range: new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1),
            options: {
              isWholeLine: true,
              className: 'errorLine',
              hoverMessage: { value: e.message },
            },
          },
          {
            range: new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1),
            options: {
              className: 'errorDecoration',
              hoverMessage: { value: e.message },
            },
          },
        ];

        // 应用装饰器
        editor.deltaDecorations([], decorations);
      } else {
        setErrors(['Unknown JSON Validation Error']);
      }
    }
  }, [code, editor]);

  const resetCode = useCallback(() => {
    if (editor) {
      editor.setValue(initialCode);
      setErrors([]);
      monaco.editor.setModelMarkers(editor.getModel()!, 'json', []);
    }
  }, [editor]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
      }}
    >
      <Box
        style={{
          height: '500px',
          border: '1px solid #ccc',
          borderRadius: '8px',
        }}
        ref={containerRef}
      />

      <div style={{ display: 'flex', gap: '20px' }}>
        <button
          type="button"
          onClick={validateCode}
          style={{
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Validate JSON
        </button>

        <button
          type="button"
          onClick={resetCode}
          style={{
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reset to Initial
        </button>
      </div>

      <Box
        style={{
          background: '#f5f5f5',
          padding: '10px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          minHeight: '100px',
        }}
      >
        <h3>Validation Results:</h3>
        {errors.length > 0 ? (
          <ul style={{ color: 'red', margin: 0 }}>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'green', margin: 0 }}>No errors found. JSON is valid!</p>
        )}
      </Box>
    </div>
  );
}

export default CodeEditorTest;
