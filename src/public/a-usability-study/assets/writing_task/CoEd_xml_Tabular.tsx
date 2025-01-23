import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

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

function useXmlEditor(initialCode: string) {
  const [code, setCode] = useState(initialCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  // 使用 DOMParser 验证 XML
  const validateXml = useCallback((currentCode: string) => {
    let validationErrors: string[] = [];
    if (!editorInstance) return currentErrors;

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(currentCode, 'application/xml');
      const parserError = xmlDoc.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        // 如果存在解析错误
        validationErrors = [parserError[0].textContent || 'Unknown XML parsing error'];
      } else {
        validationErrors = ['No errors found. XML is valid!'];
      }
      monaco.editor.setModelMarkers(editorInstance.getModel()!, 'xml', []);
    } catch (e) {
      if (e instanceof Error) {
        const errorMsg = e.message;
        validationErrors = [errorMsg];
        monaco.editor.setModelMarkers(editorInstance.getModel()!, 'xml', [{
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: Number.MAX_VALUE,
          message: errorMsg,
          severity: monaco.MarkerSeverity.Error,
        }]);
      }
    }

    setCurrentErrors(validationErrors);
    return validationErrors;
  }, [editorInstance, currentErrors]);

  return {
    code,
    setCode,
    currentErrors,
    validateXml,
    setEditorInstance,
  };
}

function CodeEditorTest({ setAnswer }: StimulusParamsTyped): React.ReactElement {
  const {
    code,
    setCode,
    currentErrors,
    validateXml,
    setEditorInstance,
  } = useXmlEditor('');

  useEffect(() => {
    const latestErrors = validateXml(code);

    setAnswer({
      status: true,
      answers: {
        code,
        error: latestErrors.join('\n'),
      },
    });
  }, [code, validateXml, setAnswer]);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'xml', // 设置语言为 XML
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
  }, [setCode, setEditorInstance]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '20px',
    }}
    >
      {/* 图示与代码编辑器 */}
      <div style={{ display: 'flex', width: '100%', gap: '20px' }}>
        <div style={{ flex: '0 0 60%' }}>
          <img
            src="./assets/tasks/fig/tabular_write.png"
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
