import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// 初始 JSON 代码
const initialCode = JSON.stringify({
  name: 'student-data',
  version: '1.0.0',
  description: 'Student information with grades and extracurricular activities.',
  homepage: 'https://example.com/student-data',
  repository: {
    type: 'git',
    url: 'https://github.com/example/student-data.git',
  },
  keywords: [
    'student',
    'grades',
    'courses',
    'extracurricular',
    'attendance',
  ],
  comments: 'Student data including grades and extracurricular activities. AB stands for absent.',
  students: [
    {
      name: 'Bob',
      age: 12,
      contact: {
        email: 'bob@example.com',
        phone: '+123456789',
        address: '123 Bob St, Some City',
      },
      courses: [
        {
          course_name: 'Math 101',
          quizzes: [
            { quiz: 1, grade: 8, weight: 0.1 },
            { quiz: 2, grade: 9, weight: 0.1 },
          ],
          midterm: {
            grade: 77,
            weight: 0.3,
          },
          final: {
            grade: 87,
            weight: 0.5,
          },
          total_score: 82.3,
          attendance: {
            total_classes: 30,
            attended_classes: 28,
            absent_classes: 2,
          },
        },
        {
          course_name: 'History 101',
          quizzes: [
            { quiz: 1, grade: 7, weight: 0.2 },
            { quiz: 2, grade: 8, weight: 0.2 },
          ],
          midterm: {
            grade: 80,
            weight: 0.4,
          },
          final: {
            grade: 85,
            weight: 0.3,
          },
          total_score: 81.3,
          attendance: {
            total_classes: 30,
            attended_classes: 30,
            absent_classes: 0,
          },
        },
      ],
      extra_curricular: {
        sports: [
          { sport_name: 'Soccer', position: 'Forward', team: 'The Tigers' },
          { sport_name: 'Basketball', position: 'Guard', team: 'The Eagles' },
        ],
        clubs: [
          { club_name: 'Science Club', role: 'President' },
          { club_name: 'Drama Club', role: 'Member' },
        ],
      },
    },
    {
      name: 'Eve',
      age: 13,
      contact: {
        email: 'eve@example.com',
        phone: '+987654321',
        address: '456 Eve St, Other City',
      },
      courses: [
        {
          course_name: 'Math 101',
          quizzes: [
            { quiz: 1, grade: 9, weight: 0.15 },
            { quiz: 2, grade: 10, weight: 0.15 },
          ],
          midterm: {
            grade: 'AB',
            weight: 0.3,
          },
          final: {
            grade: 77,
            weight: 0.4,
          },
          total_score: 78.3,
          attendance: {
            total_classes: 30,
            attended_classes: 27,
            absent_classes: 3,
          },
        },
      ],
      extra_curricular: {
        sports: [
          { sport_name: 'Tennis', position: 'Singles', team: 'The Champions' },
        ],
        clubs: [
          { club_name: 'Art Club', role: 'Vice President' },
        ],
      },
    },
    {
      name: 'Alice',
      age: 17,
      contact: {
        email: 'alice@example.com',
        phone: '+112233445',
        address: '789 Alice St, Another City',
      },
      courses: [
        {
          course_name: 'Math 101',
          quizzes: [
            { quiz: 1, grade: 6, weight: 0.2 },
          ],
          midterm: {
            grade: 88,
            weight: 0.4,
          },
          final: {
            grade: 'AB',
            weight: 0.4,
          },
          total_score: 83.2,
          attendance: {
            total_classes: 30,
            attended_classes: 25,
            absent_classes: 5,
          },
        },
      ],
      extra_curricular: {
        sports: [],
        clubs: [
          { club_name: 'Music Club', role: 'Member' },
        ],
      },
    },
  ],
}, null, 2);

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

function useJsonEditor(initialJsonCode: string) {
  const [code, setCode] = useState(initialJsonCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateJson = useCallback((currentCode: string) => {
    let validationErrors: string[] = [];
    if (!editorInstance) return currentErrors;

    try {
      JSON.parse(currentCode);
      validationErrors = ['No errors found. JSON is valid!'];
      monaco.editor.setModelMarkers(editorInstance.getModel()!, 'json', []);
    } catch (e) {
      if (e instanceof SyntaxError && e.message) {
        const match = /at position (\d+)/.exec(e.message);
        if (match) {
          const position = parseInt(match[1], 10);
          const lines = currentCode.slice(0, position).split('\n');
          const lineNumber = lines.length;
          const startColumn = lines[lineNumber - 1].length + 1;

          validationErrors = [`Syntax error at line ${lineNumber}, column ${startColumn}: ${e.message}`];

          monaco.editor.setModelMarkers(editorInstance.getModel()!, 'json', [
            {
              startLineNumber: lineNumber,
              startColumn,
              endLineNumber: lineNumber,
              endColumn: startColumn + 1,
              message: e.message,
              severity: monaco.MarkerSeverity.Error,
            },
          ]);
        } else {
          validationErrors = [e.message];
        }
      }
    }

    setCurrentErrors(validationErrors);
    return validationErrors;
  }, [editorInstance, currentErrors]);

  return {
    code,
    setCode,
    currentErrors,
    validateJson,
    setEditorInstance,
  };
}

function CodeEditorTest({ setAnswer }: StimulusParamsTyped): React.ReactElement {
  const {
    code,
    setCode,
    currentErrors,
    validateJson,
    setEditorInstance,
  } = useJsonEditor(initialCode); // 使用我们定义的初始 JSON 代码

  useEffect(() => {
    const latestErrors = validateJson(code);

    setAnswer({
      status: true,
      answers: {
        code,
        error: latestErrors.join('\n'),
      },
    });
  }, [code, validateJson, setAnswer]);

  // 配置 JSON 语言特性
  useEffect(() => {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      schemas: [],
      enableSchemaRequest: false,
      schemaRequest: 'ignore',
      schemaValidation: 'ignore',
    });
  }, []);

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
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on',
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
