import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// 初始 JSON 代码
const initialCode = JSON.stringify({
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
  files: [
    'dist/**/*.js',
    'src/**/*.js',
  ],
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
  comments: 'd3-random is a peer dependency.',
  scripts: {
    test: "mocha 'test/**/*-test.js' && eslint src test",
    prepublishOnly: 'rm -rf dist && yarn test && rollup -c',
    postpublish: 'git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -',
  },
  engines: {
    node: '>=12',
  },
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
