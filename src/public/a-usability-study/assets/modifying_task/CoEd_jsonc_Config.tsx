import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

const initialCode = `{
  // D3 Hierarchy Module Package Configuration
  "name": "d3-hierarchy",
  "version": "3.1.2",
  "description": "Layout algorithms for visualizing hierarchical data.",
  "homepage": "https://d3js.org/d3-hierarchy/",
  "repository": {
    "type": "git",
    "url": "https://github.com/d3/d3-hierarchy.git", // Repository URL
  },
  "keywords": [
    "d3",
    "d3-module",
    "layout",
    "tree",
    "treemap",
    "hierarchy",
    "infovis", // Last item with trailing comma
  ],
  "license": "ISC",
  "author": {
    "name": "Mike Bostock", // Creator of D3.js
    "url": "http://bost.ocks.org/mike", // Author URL
  },
  "type": "module",
  "files": [
    "dist/**/*.js", 
    "src/**/*.js", // Source files
  ],
  "module": "src/index.js",
  "main": "src/index.js",
  // CDN links
  "jsdelivr": "dist/d3-hierarchy.min.js", 
  "unpkg": "dist/d3-hierarchy.min.js",
  "exports": {
    "umd": "./dist/d3-hierarchy.min.js",
    "default": "./src/index.js", // Default export
  },
  "sideEffects": false,
  "devDependencies": {
    "benchmark": "2",
    "d3-array": "1.2.0 - 3",
    "d3-dsv": "1 - 3", 
    "d3-random": "1.1.0 - 3",
    "eslint": "8",
    "mocha": "9",
    "rollup": "2",
    "rollup-plugin-terser": "7", // Terser plugin
  },
  "scripts": {
    // Test and publish scripts
    "test": "mocha 'test/**/*-test.js' && eslint src test",
    "prepublishOnly": "rm -rf dist && yarn test && rollup -c",
    "postpublish": "git push && git push --tags && cd ../d3.github.com && git pull && cp ../package_name/dist/package_name.js package_name.v1.js && cp ../package_name/dist/package_name.min.js package_name.v1.min.js && git add package_name.v1.js package_name.v1.min.js && git commit -m \"package_name v1\" && git push && cd -"
  },
  "engines": {
    "node": ">=12" // Minimum Node.js version
  }
}`;

function validateJSONC(jsonc: string): { valid: boolean; error?: string } {
  try {
    // 移除单行注释和尾随注释
    let cleanedCode = jsonc.replace(/\/\/.*$/gm, '');
    
    // 移除多行注释 /* */
    cleanedCode = cleanedCode.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 处理尾随逗号
    cleanedCode = cleanedCode
      // 移除对象和数组中的尾随逗号
      .replace(/,\s*}/g, '}')   // 对象中的尾随逗号
      .replace(/,\s*\]/g, ']')  // 数组中的尾随逗号
      .replace(/,\s*(?=\}|\])/g, '') // 另一种尾随逗号处理方式
      .trim();

    // 尝试解析
    JSON.parse(cleanedCode);
    return { valid: true };
  } catch (error) {
    // 如果解析失败，返回错误信息
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown parsing error' 
    };
  }
}

function CodeEditorTest(): React.ReactElement {
  const [code, setCode] = useState(initialCode);
  const [errors, setErrors] = useState<string[]>([]);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  // 添加自定义错误样式
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .errorDecoration {
        border-bottom: 2px wavy #ff0000;
        background-color: rgba(255, 0, 0, 0.2);
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      editor?.dispose();
      styleElement.remove();
    };
  }, [editor]);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node && !editor) {
      // 配置 Monaco 编辑器的 JSONC 语言支持
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        schemaValidation: 'warning',
      });

      const instance = monaco.editor.create(node, {
        value: code,
        language: 'jsonc',
        theme: 'hc-black',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        folding: true,
        lineNumbers: 'on',
        renderValidationDecorations: 'on',
      });
      setEditor(instance);

      instance.onDidChangeModelContent(() => {
        setCode(instance.getValue());
      });
    }
  }, [editor, code]);

  // 在编辑器初始化时添加错误装饰器的支持
  useEffect(() => {
    if (editor) {
      // 添加自定义样式
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .errorLine {
          background-color: rgba(255, 0, 0, 0.2) !important;
          border-radius: 3px;
        }
        .monaco-editor .errorDecoration {
          background: none !important;
          border: none !important;
          border-bottom: 4px wavy #ff3333 !important;
          margin-bottom: 4px;
          box-sizing: border-box;
        }
      `;
      document.head.appendChild(styleElement);

      return () => {
        styleElement.remove();
        editor.dispose();
      };
    }
  }, [editor]);

  const validateCode = useCallback(() => {
    if (!editor) return;

    const validationResult = validateJSONC(code);

    if (validationResult.valid) {
      // 验证成功
      setErrors([]);
      editor.deltaDecorations([], []);
    } else {
      // 验证失败
      const errorMessage = validationResult.error || 'Unknown JSON validation error';
      setErrors([errorMessage]);

      // 尝试定位错误行
      try {
        JSON.parse(code);
      } catch (e: any) {
        if (e.lineNumber && editor) {
          const decorations = [{
            range: new monaco.Range(e.lineNumber, 1, e.lineNumber, 1000),
            options: {
              className: 'errorLine errorDecoration',
              hoverMessage: { value: errorMessage }
            }
          }];

          editor.deltaDecorations([], decorations);
        }
      }
    }
  }, [code, editor]);

  const resetCode = useCallback(() => {
    if (editor) {
      editor.setValue(initialCode);
      setErrors([]);
      editor.deltaDecorations([], []);
    }
  }, [editor]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
      }}
    >
      <Box
        style={{
          height: '500px',
          border: '1px solid #ccc',
          borderRadius: '8px',
        }}
        ref={containerRef}
      />

      <div style={{ display: 'flex', gap: '20px' }}>
        <button
          type="button"
          onClick={validateCode}
          style={{
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Validate JSONC
        </button>

        <button
          type="button"
          onClick={resetCode}
          style={{
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reset to Initial
        </button>
      </div>

      <Box
        style={{
          background: '#f5f5f5',
          padding: '10px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          minHeight: '100px',
        }}
      >
        <h3>Validation Results:</h3>
        {errors.length > 0 ? (
          <ul style={{ color: 'red', margin: 0 }}>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'green', margin: 0 }}>No errors found. JSONC is valid!</p>
        )}
      </Box>
    </div>
  );
}

export default CodeEditorTest;