import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

function useJsonEditor(initialCode: string) {
  const [code, setCode] = useState(initialCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  // JSON 验证
  const validateJson = useCallback(() => {
    if (!editorInstance) return;

    try {
      JSON.parse(code);
      setCurrentErrors(['No errors found. JSON is valid!']);
      monaco.editor.setModelMarkers(editorInstance.getModel()!, 'json', []);
    } catch (e) {
      if (e instanceof Error) {
        const errorMsg = e.message;
        const lineMatch = code.substring(0, e.message.indexOf('"')).split('\n');
        const lineNumber = lineMatch.length;

        setCurrentErrors([errorMsg]);

        monaco.editor.setModelMarkers(editorInstance.getModel()!, 'json', [{
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: Number.MAX_VALUE,
          message: errorMsg,
          severity: monaco.MarkerSeverity.Error,
        }]);
      }
    }
  }, [code, editorInstance]);

  // 实时验证
  useEffect(() => {
    if (code.trim()) {
      validateJson();
    } else {
      setCurrentErrors([]);
      if (editorInstance) {
        monaco.editor.setModelMarkers(editorInstance.getModel()!, 'json', []);
      }
    }
  }, [code, validateJson, editorInstance]);

  return {
    code,
    setCode,
    currentErrors,
    setEditorInstance,
  };
}

function CodeEditorTest(): React.ReactElement {
  const {
    code,
    setCode,
    currentErrors,
    setEditorInstance,
  } = useJsonEditor('');

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'json',
        theme: 'hc-black',
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCode, setEditorInstance]); // 移除 code 依赖，添加 eslint-disable 注释

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '20px',
    }}
    >
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

export default CodeEditorTest;
