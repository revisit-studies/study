import React, { useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// 注册 TOML 语言
monaco.languages.register({ id: 'toml' });

// 改进的 TOML 语法高亮规则，添加注释支持
monaco.languages.setMonarchTokensProvider('toml', {
  tokenizer: {
    root: [
      [/#.*$/, 'comment'], // 添加注释支持
      [/".*?"/, 'string'], // 字符串
      [/[-+]?[0-9]+(\.[0-9]+)?/, 'number'], // 数字
      [/(true|false)/, 'keyword'], // 布尔值
      [/\[.*?\]/, 'namespace'], // 表格头
      [/^[a-zA-Z0-9_-]+(?=\s*=)/, 'key'], // 键名
    ],
  },
});

// 自定义 hc-black 主题，添加注释样式
monaco.editor.defineTheme('hc-black', {
  base: 'hc-black',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955' }, // 添加注释样式
    { token: 'string', foreground: 'ce9178' },
    { token: 'number', foreground: 'b5cea8' },
    { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
    { token: 'namespace', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'key', foreground: 'dcdcaa', fontStyle: 'italic' },
  ],
  colors: {
    'editor.foreground': '#ffffff',
    'editor.background': '#000000',
    'editor.lineHighlightBackground': '#333333',
    'editorCursor.foreground': '#ffffff',
    'editor.selectionBackground': '#264f78',
    'editorLineNumber.foreground': '#858585',
  },
});

// 初始代码保持不变
const initialCode = `name = "student-data"
version = "1.0.0"
description = "Student information with grades and extracurricular activities."
homepage = "https://example.com/student-data"
comments = "Student data including grades and extracurricular activities. AB stands for absent."

[repository]
type = "git"
url = "https://github.com/example/student-data.git"

keywords = [
  "student",
  "grades",
  "courses",
  "extracurricular",
  "attendance"
]

[[students]]
name = "Bob"
age = 12

[[students.contact]]
email = "bob@example.com"
phone = "+123456789"
address = "123 Bob St, Some City"

[[students.courses]]
course_name = "Math 101"

[[students.courses.quizzes]]
quiz = 1
grade = 8
weight = 0.1

[[students.courses.quizzes]]
quiz = 2
grade = 9
weight = 0.1

[students.courses.midterm]
grade = 77
weight = 0.3

[students.courses.final]
grade = 87
weight = 0.5

[students.courses.total_score]
value = 82.3

[students.courses.attendance]
total_classes = 30
attended_classes = 28
absent_classes = 2

[[students.courses]]
course_name = "History 101"

[[students.courses.quizzes]]
quiz = 1
grade = 7
weight = 0.2

[[students.courses.quizzes]]
quiz = 2
grade = 8
weight = 0.2

[students.courses.midterm]
grade = 80
weight = 0.4

[students.courses.final]
grade = 85
weight = 0.3

[students.courses.total_score]
value = 81.3

[students.courses.attendance]
total_classes = 30
attended_classes = 30
absent_classes = 0

[[students.extra_curricular.sports]]
sport_name = "Soccer"
position = "Forward"
team = "The Tigers"

[[students.extra_curricular.sports]]
sport_name = "Basketball"
position = "Guard"
team = "The Eagles"

[[students.extra_curricular.clubs]]
club_name = "Science Club"
role = "President"

[[students.extra_curricular.clubs]]
club_name = "Drama Club"
role = "Member"

[[students]]
name = "Eve"
age = 13

[[students.contact]]
email = "eve@example.com"
phone = "+987654321"
address = "456 Eve St, Other City"

[[students.courses]]
course_name = "Math 101"

[[students.courses.quizzes]]
quiz = 1
grade = 9
weight = 0.15

[[students.courses.quizzes]]
quiz = 2
grade = 10
weight = 0.15

[students.courses.midterm]
grade = "AB"
weight = 0.3

[students.courses.final]
grade = 77
weight = 0.4

[students.courses.total_score]
value = 78.3

[students.courses.attendance]
total_classes = 30
attended_classes = 27
absent_classes = 3

[[students.extra_curricular.sports]]
sport_name = "Tennis"
position = "Singles"
team = "The Champions"

[[students.extra_curricular.clubs]]
club_name = "Art Club"
role = "Vice President"

[[students]]
name = "Alice"
age = 17

[[students.contact]]
email = "alice@example.com"
phone = "+112233445"
address = "789 Alice St, Another City"

[[students.courses]]
course_name = "Math 101"

[[students.courses.quizzes]]
quiz = 1
grade = 6
weight = 0.2

[students.courses.midterm]
grade = 88
weight = 0.4

[students.courses.final]
grade = "AB"
weight = 0.4

[students.courses.total_score]
value = 83.2

[students.courses.attendance]
total_classes = 30
attended_classes = 25
absent_classes = 5

[[students.extra_curricular.clubs]]
club_name = "Music Club"
role = "Member"
`;

function CodeEditorTest(): React.ReactElement {
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

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: initialCode,
        language: 'toml',
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
