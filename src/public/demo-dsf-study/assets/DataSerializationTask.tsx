import {
  Alert, Badge, Button, Code, Group, Paper, Radio, ScrollArea, Stack, Text, Textarea, Title,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { StimulusParams } from '../../../store/types';

type DataContext = 'config' | 'tabular';
type SerializationFormat = 'JSON' | 'JSONC' | 'JSON5' | 'HJSON' | 'YAML' | 'TOML' | 'XML';
type TaskType = 'reading' | 'authoring' | 'modifying';

interface DataSerializationTaskParameters {
  dataContext: DataContext;
  format: SerializationFormat;
  taskType: TaskType;
  taskId: string;
}

const CONFIG_DOCUMENTS: Record<SerializationFormat, string> = {
  JSON: '{\n  "name": "d3",\n  "version": "7.9.0",\n  "engines": { "node": ">=18" },\n  "keywords": ["visualization", "data"],\n  "repository": { "type": "git", "url": "https://github.com/d3/d3" },\n  "dependencies": { "d3-array": "^3.2.4", "d3-scale": "^4.0.2" }\n}',
  JSONC: '// Visualization package configuration\n{\n  "name": "d3",\n  "version": "7.9.0",\n  "engines": { "node": ">=18" },\n  "keywords": ["visualization", "data"],\n  "repository": { "type": "git", "url": "https://github.com/d3/d3" },\n  "dependencies": { "d3-array": "^3.2.4", "d3-scale": "^4.0.2" },\n}',
  JSON5: "// Visualization package configuration\n{\n  name: 'd3',\n  version: '7.9.0',\n  engines: { node: '>=18' },\n  keywords: ['visualization', 'data'],\n  repository: { type: 'git', url: 'https://github.com/d3/d3' },\n  dependencies: { 'd3-array': '^3.2.4', 'd3-scale': '^4.0.2' },\n}",
  HJSON: '# Visualization package configuration\nname: d3\nversion: 7.9.0\nengines: { node: >=18 }\nkeywords: [visualization, data]\nrepository: { type: git, url: https://github.com/d3/d3 }\ndependencies: { d3-array: ^3.2.4, d3-scale: ^4.0.2 }',
  YAML: '# Visualization package configuration\nname: d3\nversion: 7.9.0\nengines:\n  node: ">=18"\nkeywords:\n  - visualization\n  - data\nrepository:\n  type: git\n  url: https://github.com/d3/d3\ndependencies:\n  d3-array: ^3.2.4\n  d3-scale: ^4.0.2',
  TOML: '# Visualization package configuration\nname = "d3"\nversion = "7.9.0"\nkeywords = ["visualization", "data"]\n\n[engines]\nnode = ">=18"\n\n[repository]\ntype = "git"\nurl = "https://github.com/d3/d3"\n\n[dependencies]\nd3-array = "^3.2.4"\nd3-scale = "^4.0.2"',
  XML: '<?xml version="1.0"?>\n<package>\n  <name>d3</name>\n  <version>7.9.0</version>\n  <engines><node>&gt;=18</node></engines>\n  <keywords><keyword>visualization</keyword><keyword>data</keyword></keywords>\n  <repository type="git"><url>https://github.com/d3/d3</url></repository>\n  <dependencies><dependency name="d3-array">^3.2.4</dependency><dependency name="d3-scale">^4.0.2</dependency></dependencies>\n</package>',
};

const TABULAR_DOCUMENTS: Record<SerializationFormat, string> = {
  JSON: '[\n  { "student": "Alice", "quiz1": 88, "quiz2": 95, "final": 92, "sports": ["tennis"], "absences": 0 },\n  { "student": "Bob", "quiz1": 76, "quiz2": 82, "final": 91, "sports": ["soccer", "track"], "absences": 1 },\n  { "student": "Carla", "quiz1": 90, "quiz2": 87, "final": 89, "sports": ["swimming"], "absences": 0 }\n]',
  JSONC: '// Student assessment records\n[\n  { "student": "Alice", "quiz1": 88, "quiz2": 95, "final": 92, "sports": ["tennis"], "absences": 0 },\n  { "student": "Bob", "quiz1": 76, "quiz2": 82, "final": 91, "sports": ["soccer", "track"], "absences": 1 },\n  { "student": "Carla", "quiz1": 90, "quiz2": 87, "final": 89, "sports": ["swimming"], "absences": 0 },\n]',
  JSON5: "// Student assessment records\n[\n  { student: 'Alice', quiz1: 88, quiz2: 95, final: 92, sports: ['tennis'], absences: 0 },\n  { student: 'Bob', quiz1: 76, quiz2: 82, final: 91, sports: ['soccer', 'track'], absences: 1 },\n  { student: 'Carla', quiz1: 90, quiz2: 87, final: 89, sports: ['swimming'], absences: 0 },\n]",
  HJSON: '# Student assessment records\n[\n  { student: Alice, quiz1: 88, quiz2: 95, final: 92, sports: [tennis], absences: 0 }\n  { student: Bob, quiz1: 76, quiz2: 82, final: 91, sports: [soccer, track], absences: 1 }\n  { student: Carla, quiz1: 90, quiz2: 87, final: 89, sports: [swimming], absences: 0 }\n]',
  YAML: '# Student assessment records\n- student: Alice\n  quiz1: 88\n  quiz2: 95\n  final: 92\n  sports: [tennis]\n  absences: 0\n- student: Bob\n  quiz1: 76\n  quiz2: 82\n  final: 91\n  sports: [soccer, track]\n  absences: 1\n- student: Carla\n  quiz1: 90\n  quiz2: 87\n  final: 89\n  sports: [swimming]\n  absences: 0',
  TOML: '# Student assessment records\n[[students]]\nstudent = "Alice"\nquiz1 = 88\nquiz2 = 95\nfinal = 92\nsports = ["tennis"]\nabsences = 0\n\n[[students]]\nstudent = "Bob"\nquiz1 = 76\nquiz2 = 82\nfinal = 91\nsports = ["soccer", "track"]\nabsences = 1\n\n[[students]]\nstudent = "Carla"\nquiz1 = 90\nquiz2 = 87\nfinal = 89\nsports = ["swimming"]\nabsences = 0',
  XML: '<?xml version="1.0"?>\n<students>\n  <student name="Alice"><quiz1>88</quiz1><quiz2>95</quiz2><final>92</final><sports><sport>tennis</sport></sports><absences>0</absences></student>\n  <student name="Bob"><quiz1>76</quiz1><quiz2>82</quiz2><final>91</final><sports><sport>soccer</sport><sport>track</sport></sports><absences>1</absences></student>\n  <student name="Carla"><quiz1>90</quiz1><quiz2>87</quiz2><final>89</final><sports><sport>swimming</sport></sports><absences>0</absences></student>\n</students>',
};

const QUESTIONS: Record<DataContext, { id: string; prompt: string; options: string[] }[]> = {
  config: [
    { id: 'version', prompt: 'What is the value of the version field?', options: ['7.9.0', '7.9', '>=18', '^4.0.2'] },
    { id: 'node', prompt: 'What Node version does this package require?', options: ['>=18', '7.9.0', '^3.2.4', 'No version is specified'] },
    { id: 'keywords', prompt: 'How many values does the keywords field contain?', options: ['One', 'Two', 'Three', 'Four'] },
  ],
  tabular: [
    { id: 'bobFinal', prompt: 'What is Bob’s final-exam grade?', options: ['82', '89', '91', '95'] },
    { id: 'aliceQuiz', prompt: 'On which quiz did Alice receive her higher grade?', options: ['Quiz 1', 'Quiz 2', 'They are equal', 'Neither quiz'] },
    { id: 'twoSports', prompt: 'Which student participates in two sports?', options: ['Alice', 'Bob', 'Carla', 'No student'] },
    { id: 'noAbsences', prompt: 'Which students have zero absences?', options: ['Alice and Bob', 'Bob and Carla', 'Alice and Carla', 'All students'] },
  ],
};

function getInstruction(dataContext: DataContext, taskType: TaskType, format: SerializationFormat) {
  const label = dataContext === 'config' ? 'software configuration' : 'student-record table';
  if (taskType === 'reading') return ['Inspect this ', label, ' expressed in ', format, ', then answer each question.'].join('');
  if (taskType === 'authoring') return ['Create the requested ', label, ' data in ', format, '. The target structure is shown in JSON as a format-neutral reference.'].join('');
  return ['Edit the ', label, ' data expressed in ', format, '. Record the complete revised document in the editor.'].join('');
}

function getAuthoringTarget(dataContext: DataContext) {
  return dataContext === 'config'
    ? '{\n  "name": "sample-viz-plugin",\n  "version": "1.0.0",\n  "enabled": true,\n  "themes": ["light", "dark"],\n  "repository": { "type": "git", "url": "https://example.org/plugin" }\n}'
    : '[\n  { "student": "Dion", "quiz1": 84, "quiz2": 90, "final": 88, "sports": ["basketball"], "absences": 0 },\n  { "student": "Eve", "quiz1": 93, "quiz2": 91, "final": 94, "sports": ["volleyball", "track"], "absences": 2 }\n]';
}

function getModificationSteps(dataContext: DataContext) {
  return dataContext === 'config'
    ? ['Change the package version to 8.0.0.', 'Add "d3-shape": "^3.2.0" under dependencies.', 'Remove the repository URL while retaining its type.', 'Add "accessibility" to the keywords list.']
    : ['Add 5 points to every final-exam grade.', 'Add "chess" to every student’s sports list.', 'Remove quiz1 from every student record.', 'Add a passing field: true when the revised final grade is at least 90, otherwise false.'];
}

export default function DataSerializationTask({ parameters, setAnswer }: StimulusParams<DataSerializationTaskParameters>) {
  const document = parameters.dataContext === 'config'
    ? CONFIG_DOCUMENTS[parameters.format]
    : TABULAR_DOCUMENTS[parameters.format];
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [writtenAnswer, setWrittenAnswer] = useState(parameters.taskType === 'modifying' ? document : '');
  const [completed, setCompleted] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);
  const questions = QUESTIONS[parameters.dataContext];
  const canComplete = parameters.taskType === 'reading'
    ? questions.every(({ id }) => responses[id])
    : writtenAnswer.trim().length > 0;

  const complete = () => {
    setCompleted(true);
    const taskDetails = {
      taskId: parameters.taskId,
      dataContext: parameters.dataContext,
      format: parameters.format,
      taskType: parameters.taskType,
      elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    };
    setAnswer({
      status: true,
      answers: parameters.taskType === 'reading'
        ? { ...taskDetails, responses }
        : { ...taskDetails, document: writtenAnswer },
    });
  };

  return (
    <Stack gap="md" maw={1080} mx="auto">
      <Group gap="xs">
        <Badge color={parameters.dataContext === 'config' ? 'violet' : 'cyan'}>{parameters.dataContext.toUpperCase()}</Badge>
        <Badge variant="light">{parameters.format}</Badge>
        <Badge variant="outline">{parameters.taskType}</Badge>
      </Group>
      <Alert color="gray" title="Task">{getInstruction(parameters.dataContext, parameters.taskType, parameters.format)}</Alert>
      {parameters.taskType === 'authoring' && (
        <Paper withBorder p="md">
          <Title order={4} mb="xs">Target structure</Title>
          <Code block>{getAuthoringTarget(parameters.dataContext)}</Code>
        </Paper>
      )}
      <Paper withBorder p="md">
        <Title order={4} mb="xs">{parameters.taskType === 'authoring' ? 'Starting point' : 'Data'}</Title>
        {parameters.taskType === 'authoring' ? <Text c="dimmed">Use the target structure above to write a new document in the assigned format.</Text> : (
          <ScrollArea h={300} type="auto"><Code block>{document}</Code></ScrollArea>
        )}
      </Paper>
      {parameters.taskType === 'reading' ? (
        <Stack gap="lg">
          {questions.map((question) => (
            <Radio.Group key={question.id} label={question.prompt} value={responses[question.id] || ''} onChange={(value) => setResponses((current) => ({ ...current, [question.id]: value }))} withAsterisk>
              <Stack gap="xs" mt="xs">
                {question.options.map((option) => <Radio key={option} value={option} label={option} disabled={completed} />)}
              </Stack>
            </Radio.Group>
          ))}
        </Stack>
      ) : (
        <>
          {parameters.taskType === 'modifying' && (
            <Alert color="orange" title="Required changes">
              <ol>{getModificationSteps(parameters.dataContext).map((step) => <li key={step}>{step}</li>)}</ol>
            </Alert>
          )}
          <Textarea aria-label={[parameters.format, parameters.taskType, 'editor'].join(' ')} autosize minRows={14} label={[parameters.format, 'document'].join(' ')} value={writtenAnswer} onChange={(event) => setWrittenAnswer(event.currentTarget.value)} disabled={completed} styles={{ input: { fontFamily: 'monospace', fontSize: 14 } }} />
        </>
      )}
      <Button onClick={complete} disabled={completed || !canComplete}>{completed ? 'Task recorded' : 'Record task response'}</Button>
    </Stack>
  );
}
