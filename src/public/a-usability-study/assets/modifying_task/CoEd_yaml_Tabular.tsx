import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import * as YAML from 'yaml'; // 只使用 yaml 包

// 初始 YAML 代码保持不变
const initialCode = `
name: student-data
version: "1.0.0"
description: Student information with grades and extracurricular activities.
homepage: https://example.com/student-data
comments: "Student data including grades and extracurricular activities. AB stands for absent."

repository:
  type: git
  url: https://github.com/example/student-data.git

keywords:
  - student
  - grades
  - courses
  - extracurricular
  - attendance

students:
  - name: Bob
    age: 12
    contact:
      email: bob@example.com
      phone: "+123456789"
      address: "123 Bob St, Some City"
    courses:
      - course_name: Math 101
        quizzes:
          - quiz: 1
            grade: 8
            weight: 0.1
          - quiz: 2
            grade: 9
            weight: 0.1
        midterm:
          grade: 77
          weight: 0.3
        final:
          grade: 87
          weight: 0.5
        total_score:
          value: 82.3
        attendance:
          total_classes: 30
          attended_classes: 28
          absent_classes: 2
      - course_name: History 101
        quizzes:
          - quiz: 1
            grade: 7
            weight: 0.2
          - quiz: 2
            grade: 8
            weight: 0.2
        midterm:
          grade: 80
          weight: 0.4
        final:
          grade: 85
          weight: 0.3
        total_score:
          value: 81.3
        attendance:
          total_classes: 30
          attended_classes: 30
          absent_classes: 0
    extra_curricular:
      sports:
        - sport_name: Soccer
          position: Forward
          team: "The Tigers"
        - sport_name: Basketball
          position: Guard
          team: "The Eagles"
      clubs:
        - club_name: Science Club
          role: President
        - club_name: Drama Club
          role: Member

  - name: Eve
    age: 13
    contact:
      email: eve@example.com
      phone: "+987654321"
      address: "456 Eve St, Other City"
    courses:
      - course_name: Math 101
        quizzes:
          - quiz: 1
            grade: 9
            weight: 0.15
          - quiz: 2
            grade: 10
            weight: 0.15
        midterm:
          grade: AB
          weight: 0.3
        final:
          grade: 77
          weight: 0.4
        total_score:
          value: 78.3
        attendance:
          total_classes: 30
          attended_classes: 27
          absent_classes: 3
    extra_curricular:
      sports:
        - sport_name: Tennis
          position: Singles
          team: "The Champions"
      clubs:
        - club_name: Art Club
          role: Vice President

  - name: Alice
    age: 17
    contact:
      email: alice@example.com
      phone: "+112233445"
      address: "789 Alice St, Another City"
    courses:
      - course_name: Math 101
        quizzes:
          - quiz: 1
            grade: 6
            weight: 0.2
        midterm:
          grade: 88
          weight: 0.4
        final:
          grade: AB
          weight: 0.4
        total_score:
          value: 83.2
        attendance:
          total_classes: 30
          attended_classes: 25
          absent_classes: 5
    extra_curricular:
      clubs:
        - club_name: Music Club
          role: Member
`;

// 注册 YAML 语言
monaco.languages.register({ id: 'yaml' });

// 设置 YAML 语法高亮规则
monaco.languages.setMonarchTokensProvider('yaml', {
  tokenizer: {
    root: [
      [/^[\s-]*([a-zA-Z0-9_-]+)(?=\s*:)/, 'key'],
      [/:\s*([a-zA-Z0-9_-]+)/, 'string'],
      [/'[^']*'/, 'string'],
      [/"[^"]*"/, 'string'],
      [/\d+/, 'number'],
      [/^-\s/, 'delimiter'],
      [/true|false/, 'keyword'],
      [/#.*$/, 'comment'],
    ],
  },
});

// 自定义主题
monaco.editor.defineTheme('yaml-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'key', foreground: '9CDCFE' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'delimiter', foreground: 'D4D4D4' },
    { token: 'keyword', foreground: '569CD6' },
    { token: 'comment', foreground: '6A9955' },
  ],
  colors: {
    'editor.foreground': '#D4D4D4',
    'editor.background': '#1E1E1E',
    'editor.lineHighlightBackground': '#2D2D2D',
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

function useYamlEditor(initialYamlCode: string) {
  const [code, setCode] = useState(initialYamlCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateYaml = useCallback((currentCode: string) => {
    let validationErrors: string[] = [];
    if (!editorInstance) return currentErrors;

    try {
      YAML.parse(currentCode, {
        strict: true,
        prettyErrors: true,
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
  } = useYamlEditor(initialCode);

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
        language: 'yaml',
        theme: 'yaml-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        formatOnPaste: true,
        formatOnType: true,
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on',
        tabSize: 2,
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
