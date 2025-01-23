import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import * as YAML from 'yaml'; // 引入 YAML 解析库

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

function useYamlEditor(initialCode: string) {
  const [code, setCode] = useState(initialCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateYaml = useCallback((currentCode: string) => {
    let validationErrors: string[] = [];
    if (!editorInstance) return currentErrors;

    try {
      YAML.parse(currentCode, {
        strict: true, // 启用严格模式
        prettyErrors: true, // 提供更易读的错误信息
      });
      validationErrors = ['No errors found. YAML is valid!'];
      monaco.editor.setModelMarkers(editorInstance.getModel()!, 'yaml', []);
    } catch (e) {
      if (e instanceof YAML.YAMLParseError) {
        const errorMsg = e.message;

        validationErrors = [errorMsg];

        monaco.editor.setModelMarkers(editorInstance.getModel()!, 'yaml', [{
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
    validateYaml,
    setEditorInstance,
  };
}

function CodeEditorTest({ setAnswer }: StimulusParamsTyped): React.ReactElement {
  const {
    code,
    setCode,
    currentErrors,
    validateYaml,
    setEditorInstance,
  } = useYamlEditor('');

  useEffect(() => {
    const latestErrors = validateYaml(code);

    setAnswer({
      status: true,
      answers: {
        code,
        error: latestErrors.join('\n'),
      },
    });
  }, [code, validateYaml, setAnswer]);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'yaml', // 设置语言为 YAML
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
