import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import { XMLValidator } from "fast-xml-parser"; // 引入 fast-xml-parser 的验证工具

function useXmlEditor(initialCode: string) {
  const [code, setCode] = useState(initialCode); // 当前编辑器内容
  const [errors, setErrors] = useState<string[]>([]); // 错误信息
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null); // 编辑器实例

  // 使用 fast-xml-parser 验证 XML
  const validateXmlWithFastXmlParser = useCallback(() => {
    if (!editorInstance) return;

    const rawCode = editorInstance.getValue(); // 获取编辑器内容
    const validationResult = XMLValidator.validate(rawCode); // 验证 XML 语法

    if (validationResult !== true) {
      // 如果验证失败，记录错误信息
      const errorMessage = validationResult.err.msg || "Unknown XML parsing error";
      setErrors([`Error at line ${validationResult.err.line}: ${errorMessage}`]);

      // 设置错误标记
      monaco.editor.setModelMarkers(editorInstance.getModel()!, "xml", [
        {
          startLineNumber: validationResult.err.line,
          startColumn: validationResult.err.col || 1,
          endLineNumber: validationResult.err.line,
          endColumn: validationResult.err.col || 1,
          message: errorMessage,
          severity: monaco.MarkerSeverity.Error,
        },
      ]);
    } else {
      // 如果验证通过，清空错误信息和标记
      setErrors([]);
      monaco.editor.setModelMarkers(editorInstance.getModel()!, "xml", []);
    }
  }, [editorInstance]);

  return { code, setCode, errors, validateXmlWithFastXmlParser, setEditorInstance };
}

function XmlEditorTest(): React.ReactElement {
  const { code, setCode, errors, validateXmlWithFastXmlParser, setEditorInstance } = useXmlEditor('<root>\n  <item>Content</item>\n</root>');

  useEffect(() => {
    // 注册 XML 语言支持
    monaco.languages.register({ id: "xml" });

    // 配置 XML 的基本语言特性
    monaco.languages.setLanguageConfiguration("xml", {
      autoClosingPairs: [
        { open: "<", close: ">" },
        { open: "'", close: "'" },
        { open: '"', close: '"' },
      ],
    });
  }, []);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code, // 初始化编辑器内容
        language: "xml", // 设置语言为 XML
        theme: "vs-light", // 使用浅色主题
        automaticLayout: true, // 自动调整布局
        minimap: { enabled: false }, // 禁用迷你地图
      });

      setEditorInstance(editor); // 设置编辑器实例

      // 监听内容变化事件
      editor.onDidChangeModelContent(() => {
        const rawCode = editor.getValue();
        setCode(rawCode); // 更新内容状态
        validateXmlWithFastXmlParser(); // 实时验证 XML
      });

      return () => editor.dispose(); // 在组件卸载时销毁编辑器实例
    }
  }, [setCode, validateXmlWithFastXmlParser, setEditorInstance]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "20px" }}>
      <div
        ref={containerRef}
        style={{
          height: "400px",
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      ></div>
      <button
        onClick={validateXmlWithFastXmlParser}
        style={{
          padding: "10px 20px",
          borderRadius: "4px",
          background: "#007bff",
          color: "#fff",
          border: "none",
          cursor: "pointer",
        }}
      >
        Validate XML
      </button>
      <Box
        style={{
          marginTop: "10px",
          background: "#f9f9f9",
          padding: "10px",
          borderRadius: "4px",
          border: "1px solid #ccc",
        }}
      >
        <h3>Validation Results:</h3>
        {errors.length > 0 ? (
          errors.map((error, index) => (
            <p key={index} style={{ color: "red", whiteSpace: "pre-wrap" }}>
              {error}
            </p>
          ))
        ) : (
          <p style={{ color: "green" }}>No errors found. XML is valid!</p>
        )}
      </Box>
    </div>
  );
}

export default XmlEditorTest;