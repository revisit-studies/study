import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { download } from '../components/StudyEnd';
import {
  isPracticeComponent,
  isSteppedComponent,
  Prettify,
} from '../parser/types';
import { State } from '../store/types';
import { getAllSessions } from './queries';
import { FsSession, ProvenanceStorage } from './types';

export const OPTIONAL_COMMON_PROPS = [
  'description',
  'instruction',
  'answer',
  'correctAnswer',
  'startTime',
  'endTime',
  'duration',
] as const;

export const REQUIRED_PROPS = [
  'pid',
  'sessionId',
  'status',
  'trialGroup',
  'trialId',
  'type',
] as const;

type OptionalProperty = (typeof OPTIONAL_COMMON_PROPS)[number];
type RequiredProperty = (typeof REQUIRED_PROPS)[number];
type MetaProperty = `meta-${string}`;

export type Property = OptionalProperty | RequiredProperty | MetaProperty;

export type TidyRow = Prettify<
  Record<RequiredProperty, any> &
    Partial<Record<OptionalProperty | MetaProperty, any>>
>;

export async function downloadTidy(
  fb: ProvenanceStorage,
  studyId: string,
  trialGroups: string[],
  properties: Property[] = [...REQUIRED_PROPS, ...OPTIONAL_COMMON_PROPS],
  filename: string
) {
  // To fill in null and replace later
  const NULL = `__NULL__${Math.random().toFixed(3)}`;

  const sessionArr = await getAllSessions(fb.firestore, studyId);
  const rows = sessionArr
    .map((sessionObject) => processToRow(sessionObject, trialGroups))
    .reduce((acc, trs) => {
      acc = [...acc, ...trs];
      return acc;
    }, []);

  const csvStrings = [properties.join(',')];

  rows.forEach((row) => {
    const arr: string[] = properties.map((prop) => {
      const val = row[prop];

      const valStr: string =
        typeof val === 'string' ? val : val ? val.toString() : NULL;

      return valStr.includes(',') ? `"${valStr}"` : valStr;
    });

    csvStrings.push(arr.join(',').replace(NULL, ''));
  });

  const csv = csvStrings.join('\n');

  download(csv, filename);
}

function processToRow(
  {
    graph,
    session,
  }: {
    graph: ProvenanceGraph<any, any, any>;
    session: FsSession;
  },
  trialGroups: string[]
): Array<TidyRow> {
  const trs: Array<TidyRow> = [];

  const nodes = Object.values(graph.nodes);
  nodes.sort((a, b) => a.meta.createdOn - b.meta.createdOn);

  const lastNode = nodes[nodes.length - 1];

  const study: State = lastNode.state.val.study;

  trialGroups.forEach((groupName) => {
    const group = study.steps[groupName];
    if (isSteppedComponent(group)) {
      const answers = isPracticeComponent(group)
        ? study.practice[groupName]
        : study.trials[groupName];
      Object.entries(group.trials).forEach(([trialId, trial]) => {
        const answer = answers[trialId];
        const startTime = new Date(answer.startTime).toUTCString();
        const endTime = new Date(answer.endTime).toUTCString();
        const duration = answer.endTime - answer.startTime;

        const tr: TidyRow = {
          pid: study.studyIdentifiers.pid,
          sessionId: study.studyIdentifiers.session_id,
          status: session.status.endStatus?.status || 'incomplete',
          type: group.type,
          trialId,
          trialGroup: groupName,
          answer: JSON.stringify(answer.answer || {}),
          correctAnswer: trial.stimulus.correctAnswer,
          description: `"${trial.description}"`,
          instruction: `"${trial.instruction}"`,
          startTime,
          endTime,
          duration,
        };

        trs.push(tr);
      });
    }
  });

  return trs;
}
