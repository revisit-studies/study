import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// 配置 Monaco Editor
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,                 // 启用验证
  allowComments: true,           // 允许注释
  allowTrailingComma: true,      // 允许尾随逗号
  allowSingleQuotes: false,      // 不允许单引号
  comments: 'ignore',            // 忽略注释
  trailingCommas: 'ignore',      // 忽略尾随逗号
  enableSchemaRequest: true,
  schemas: [],
  schemaValidation: 'error',     // schema 验证错误级别
  schemaRequest: 'error'         // schema 请求错误级别
});

function useJsoncEditor(initialCode: string) {
  const [code, setCode] = useState(initialCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  // 更新错误信息
  const validateJsonc = useCallback(() => {
    if (!editorInstance) return;

    const model = editorInstance.getModel();
    if (!model) return;

    try {
      // 首先获取编辑器的标记
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      
      // 然后尝试解析 JSONC（去除注释后）
      const codeWithoutComments = code
        .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
        .replace(/\/\/.*/g, '');          // 移除单行注释

      if (codeWithoutComments.trim()) {
        // 尝试解析，如果有基本语法错误会抛出异常
        JSON.parse(codeWithoutComments);
      }

      if (markers.length === 0) {
        setCurrentErrors(['No errors found. JSONC is valid!']);
      } else {
        const errorMessages = markers.map(marker => 
          `Line ${marker.startLineNumber}: ${marker.message}`
        );
        setCurrentErrors(errorMessages);
      }
    } catch (e) {
      if (e instanceof Error) {
        // 解析错误，更新错误消息
        setCurrentErrors([`JSON syntax error: ${e.message}`]);
        
        // 添加错误标记
        if (model) {
          monaco.editor.setModelMarkers(model, 'json', [{
            severity: monaco.MarkerSeverity.Error,
            message: e.message,
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: model.getLineCount(),
            endColumn: model.getLineMaxColumn(model.getLineCount())
          }]);
        }
      }
    }
  }, [code, editorInstance]);

  // 监听编辑器内容变化和标记变化
  useEffect(() => {
    if (!editorInstance) return;

    const model = editorInstance.getModel();
    if (!model) return;

    const disposables = [
      editorInstance.onDidChangeModelContent(() => {
        validateJsonc();
      }),
      monaco.editor.onDidChangeMarkers(([uri]) => {
        if (uri.toString() === model.uri.toString()) {
          validateJsonc();
        }
      })
    ];

    // 初始验证
    validateJsonc();

    return () => {
      disposables.forEach(d => d.dispose());
    };
  }, [editorInstance, validateJsonc]);

  return {
    code,
    setCode,
    currentErrors,
    setEditorInstance
  };
}

function JsoncEditorTest(): React.ReactElement {
  const {
    code,
    setCode,
    currentErrors,
    setEditorInstance
  } = useJsoncEditor('');

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'json',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        formatOnPaste: true,
        formatOnType: true,
        scrollBeyondLastLine: false,
        renderValidationDecorations: 'on',
        fixedOverflowWidgets: true
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
  }, [setCode, setEditorInstance]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '20px',
    }}>
      {/* 图片与代码编辑器部分 */}
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

      {/* 验证状态显示 */}
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

export default JsoncEditorTest;