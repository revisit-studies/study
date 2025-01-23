import React, { useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// JSON 格式的初始代码
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
        language: 'xml',
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
