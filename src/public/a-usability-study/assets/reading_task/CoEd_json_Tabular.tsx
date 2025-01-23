import React, { useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// JSON 格式的初始代码
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

function CodeEditorTest(): React.ReactElement {
  // 配置 Monaco Editor 的语言支持
  useEffect(() => {
    // 配置 JSON 语言特性
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      schemas: [],
      enableSchemaRequest: false,
      schemaRequest: 'ignore',
      schemaValidation: 'ignore',
    });
  }, []);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: initialCode,
        language: 'json',
        theme: 'hc-black',
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderValidationDecorations: 'on',
        folding: true,
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on',
      });

      return () => {
        editor.dispose();
      };
    }
    return undefined;
  }, []);

  return (
    <Box
      style={{
        height: '700px',
        border: '1px solid #ccc',
        borderRadius: '8px',
      }}
      ref={containerRef}
    />
  );
}

export default CodeEditorTest;
