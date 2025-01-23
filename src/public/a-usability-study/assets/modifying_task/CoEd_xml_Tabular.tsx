import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
// 初始 XML 代码
const initialCode = `<?xml version="1.0" encoding="UTF-8"?>
<package>
  <name>student-data</name>
  <version>1.0.0</version>
  <description>Student information with grades and extracurricular activities.</description>
  <homepage>https://example.com/student-data</homepage>
  <comments>Student data including grades and extracurricular activities. AB stands for absent.</comments>
  
  <repository>
    <type>git</type>
    <url>https://github.com/example/student-data.git</url>
  </repository>

  <keywords>
    <keyword>student</keyword>
    <keyword>grades</keyword>
    <keyword>courses</keyword>
    <keyword>extracurricular</keyword>
    <keyword>attendance</keyword>
  </keywords>

  <students>
    <student>
      <name>Bob</name>
      <age>12</age>
      <contact>
        <email>bob@example.com</email>
        <phone>+123456789</phone>
        <address>123 Bob St, Some City</address>
      </contact>
      <courses>
        <course>
          <course_name>Math 101</course_name>
          <quizzes>
            <quiz>
              <quiz_number>1</quiz_number>
              <grade>8</grade>
              <weight>0.1</weight>
            </quiz>
            <quiz>
              <quiz_number>2</quiz_number>
              <grade>9</grade>
              <weight>0.1</weight>
            </quiz>
          </quizzes>
          <midterm>
            <grade>77</grade>
            <weight>0.3</weight>
          </midterm>
          <final>
            <grade>87</grade>
            <weight>0.5</weight>
          </final>
          <total_score>
            <value>82.3</value>
          </total_score>
          <attendance>
            <total_classes>30</total_classes>
            <attended_classes>28</attended_classes>
            <absent_classes>2</absent_classes>
          </attendance>
        </course>
        <course>
          <course_name>History 101</course_name>
          <quizzes>
            <quiz>
              <quiz_number>1</quiz_number>
              <grade>7</grade>
              <weight>0.2</weight>
            </quiz>
            <quiz>
              <quiz_number>2</quiz_number>
              <grade>8</grade>
              <weight>0.2</weight>
            </quiz>
          </quizzes>
          <midterm>
            <grade>80</grade>
            <weight>0.4</weight>
          </midterm>
          <final>
            <grade>85</grade>
            <weight>0.3</weight>
          </final>
          <total_score>
            <value>81.3</value>
          </total_score>
          <attendance>
            <total_classes>30</total_classes>
            <attended_classes>30</attended_classes>
            <absent_classes>0</absent_classes>
          </attendance>
        </course>
      </courses>
      <extra_curricular>
        <sports>
          <sport>
            <sport_name>Soccer</sport_name>
            <position>Forward</position>
            <team>The Tigers</team>
          </sport>
          <sport>
            <sport_name>Basketball</sport_name>
            <position>Guard</position>
            <team>The Eagles</team>
          </sport>
        </sports>
        <clubs>
          <club>
            <club_name>Science Club</club_name>
            <role>President</role>
          </club>
          <club>
            <club_name>Drama Club</club_name>
            <role>Member</role>
          </club>
        </clubs>
      </extra_curricular>
    </student>

    <student>
      <name>Eve</name>
      <age>13</age>
      <contact>
        <email>eve@example.com</email>
        <phone>+987654321</phone>
        <address>456 Eve St, Other City</address>
      </contact>
      <courses>
        <course>
          <course_name>Math 101</course_name>
          <quizzes>
            <quiz>
              <quiz_number>1</quiz_number>
              <grade>9</grade>
              <weight>0.15</weight>
            </quiz>
            <quiz>
              <quiz_number>2</quiz_number>
              <grade>10</grade>
              <weight>0.15</weight>
            </quiz>
          </quizzes>
          <midterm>
            <grade>AB</grade>
            <weight>0.3</weight>
          </midterm>
          <final>
            <grade>77</grade>
            <weight>0.4</weight>
          </final>
          <total_score>
            <value>78.3</value>
          </total_score>
          <attendance>
            <total_classes>30</total_classes>
            <attended_classes>27</attended_classes>
            <absent_classes>3</absent_classes>
          </attendance>
        </course>
      </courses>
      <extra_curricular>
        <sports>
          <sport>
            <sport_name>Tennis</sport_name>
            <position>Singles</position>
            <team>The Champions</team>
          </sport>
        </sports>
        <clubs>
          <club>
            <club_name>Art Club</club_name>
            <role>Vice President</role>
          </club>
        </clubs>
      </extra_curricular>
    </student>

    <student>
      <name>Alice</name>
      <age>17</age>
      <contact>
        <email>alice@example.com</email>
        <phone>+112233445</phone>
        <address>789 Alice St, Another City</address>
      </contact>
      <courses>
        <course>
          <course_name>Math 101</course_name>
          <quizzes>
            <quiz>
              <quiz_number>1</quiz_number>
              <grade>6</grade>
              <weight>0.2</weight>
            </quiz>
          </quizzes>
          <midterm>
            <grade>88</grade>
            <weight>0.4</weight>
          </midterm>
          <final>
            <grade>AB</grade>
            <weight>0.4</weight>
          </final>
          <total_score>
            <value>83.2</value>
          </total_score>
          <attendance>
            <total_classes>30</total_classes>
            <attended_classes>25</attended_classes>
            <absent_classes>5</absent_classes>
          </attendance>
        </course>
      </courses>
      <extra_curricular>
        <clubs>
          <club>
            <club_name>Music Club</club_name>
            <role>Member</role>
          </club>
        </clubs>
      </extra_curricular>
    </student>
  </students>
</package>`;
// 注册 XML 语言
monaco.languages.register({ id: 'xml' });

monaco.languages.setMonarchTokensProvider('xml', {
  autoClosingPairs: [
    { open: '<!--', close: ' -->' },
    { open: '<![CDATA[', close: ']]>' },
    { open: '<', close: '>' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  defaultToken: '',
  tokenPostfix: '.xml',

  ignoreCase: true,

  tokenizer: {
    root: [
      [/[^<&]+/, ''],
      { include: '@whitespace' },

      // XML Declaration
      [/(<\?)\s*([a-zA-Z0-9_-]+)/, [ // 移除了 - 的转义
        { token: 'delimiter.xml' },
        { token: 'metatag.xml' },
      ]],
      [/\?>/, 'delimiter.xml'],

      // DOCTYPE
      [/(<![^>]+>)/, 'metatag.xml'],

      // Tags
      [/(<)([a-zA-Z0-9_-]+)/, [ // 移除了 \w 和 - 的转义
        { token: 'delimiter.xml' },
        { token: 'tag.xml' },
      ]],
      [/(>)/, 'delimiter.xml'],
      [/(<\/)([a-zA-Z0-9_-]+)/, [ // 移除了 \w 和 - 的转义
        { token: 'delimiter.xml' },
        { token: 'tag.xml' },
      ]],
      [/([a-zA-Z0-9_-]+)(=)/, [ // 移除了 \w 和 - 的转义
        { token: 'attribute.name.xml' },
        { token: 'delimiter.xml' },
      ]],
      [/"([^"]*)"/, 'string.xml'],
      [/'([^']*)'/, 'string.xml'],
      [/[a-zA-Z0-9_-]+/, 'identifier.xml'], // 移除了 \w 和 - 的转义
      [/[<>&]/, 'delimiter.xml'],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/<!--/, 'comment', '@comment'],
    ],

    comment: [
      [/[^-]+/, 'comment.content'],
      [/-->/, 'comment', '@pop'],
      [/[-]+/, 'comment.content'],
    ],
  },
});

// 自定义 XML 主题
monaco.editor.defineTheme('xml-dark', {
  base: 'hc-black',
  inherit: true,
  rules: [
    { token: 'tag.xml', foreground: '569CD6' },
    { token: 'delimiter.xml', foreground: '808080' },
    { token: 'attribute.name.xml', foreground: '9CDCFE' },
    { token: 'string.xml', foreground: 'CE9178' },
    { token: 'metatag.xml', foreground: '569CD6' },
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

function useXmlEditor(initialXmlCode: string) {
  const [code, setCode] = useState(initialXmlCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateXml = useCallback((currentCode: string) => {
    let validationErrors: string[] = [];
    if (!editorInstance) return currentErrors;

    try {
      // 在这里进行实体编码转换
      const processedCode = currentCode
        .replace(/&&/g, '&amp;&amp;')
        .replace(/>=</g, '&gt;=<')
        .replace(/>=([^<])/g, '&gt;=$1');

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(processedCode, 'text/xml');

      // 检查解析错误
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        const errorText = parseError[0].textContent || 'XML parsing error';
        // 尝试从错误消息中提取行号和列号
        const lineMatch = errorText.match(/line (\d+)/i);
        const colMatch = errorText.match(/column (\d+)/i);

        if (lineMatch && colMatch) {
          const line = parseInt(lineMatch[1], 10);
          const column = parseInt(colMatch[1], 10);

          validationErrors = [`Syntax error at line ${line}, column ${column}: ${errorText}`];

          monaco.editor.setModelMarkers(editorInstance.getModel()!, 'xml', [{
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: column + 1,
            message: errorText,
            severity: monaco.MarkerSeverity.Error,
          }]);
        } else {
          validationErrors = [errorText];
        }
      } else {
        validationErrors = ['No errors found. XML is valid!'];
        monaco.editor.setModelMarkers(editorInstance.getModel()!, 'xml', []);
      }
    } catch (e) {
      if (e instanceof Error) {
        validationErrors = [e.message];
      } else {
        validationErrors = ['Unknown error occurred while validating XML'];
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
  } = useXmlEditor(initialCode);

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
        language: 'xml',
        theme: 'xml-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        formatOnPaste: true,
        formatOnType: true,
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on',
        renderWhitespace: 'all',
        folding: true,
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
