import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { download } from '../components/DownloadPanel';

import {
  Nullable,
  Prettify,
} from '../parser/types';
import { getAllSessions } from './queries';
import { FsSession, ProvenanceStorage } from './types';
import { TrialResult } from '../store/types';

export const OPTIONAL_COMMON_PROPS = [
  'description',
  'instruction',
  'answer',
  'correctAnswer',
  'startTime',
  'endTime',
  'duration',
    'studyId',
    'measure',
] as const;

export const REQUIRED_PROPS = [
  'pid',
  'sessionId',
  'status',
  'trialId',
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
  trialIds: string[],
  properties: Property[] = [...REQUIRED_PROPS, ...OPTIONAL_COMMON_PROPS],
  filename: string
) {
  // To fill in null and replace later
  const NULL = ' ';

  const sessionArr = await getAllSessions(fb.firestore, studyId);

  const rows = sessionArr
      .filter((sessionObject)=>sessionObject.session.status.endStatus?.status === 'completed')
    .map((sessionObject) => processToRow(sessionObject, trialIds)).flat();

  const csvStrings = [properties.join(',')];

  rows.filter((row) => row !== null).forEach((row) => {
    const arr: string[] = properties.map((prop) => {
      const val = row?.[prop];

      const valStr: string =
        typeof val === 'string' ? val : val ? val.toString() : NULL;

      return valStr.includes(',') || valStr.includes('\n')
        ? `"${valStr}"`
        : valStr;
    });

    csvStrings.push(arr.join(',').replace(NULL, ''));
  });

  const csv = csvStrings.join('\n');

  download(csv, filename);
}

function processToRow(
  {
    graph,
    session
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    graph: ProvenanceGraph<any, any, any>;
    session: FsSession
  },
  trialIds: string[],
): Array<TidyRow> | null {
  const trs: Array<TidyRow> = [];

  const nodes = Object.values(graph.nodes);
  nodes.sort((a, b) => a.meta.createdOn - b.meta.createdOn);

  if(nodes.length < 3) {
    return null;
  }

  const lastNode = nodes[nodes.length - 1];

  const study = lastNode.state.val.trrackedSlice;

  trialIds.forEach((trialId) => {
    const trial = study[trialId];
    if(trial) {
      const answer: Nullable<TrialResult> =
          'answer' in trial ? trial : null;
      const startTime = answer?.startTime
          ? new Date(answer.startTime).toUTCString()
          : null;
      const endTime = answer?.endTime
          ? new Date(answer.endTime).toUTCString()
          : null;
      const duration = (answer?.endTime || 0) - (answer?.startTime || 0);

      const answers: { [key: string]: string } = answer?.answer as { [key: string]: string };
      for (const key in answers) {
        if (Object.prototype.hasOwnProperty.call(answers, key)) {
          const answerField = key.split('/').filter((f)=>f.length>0);

          const tr: TidyRow = {
            pid: study.studyIdentifiers.pid,
            sessionId: study.studyIdentifiers.session_id,
            status: session.status.endStatus?.status || 'incomplete',
            trialId,
            answer: answers[key],
            studyId:answerField[0],
            measure:answerField[2],
            correctAnswer: (trial).correctAnswer,
            description: `"${(trial).description}"`,
            instruction: `"${(trial).instruction}"`,
            startTime,
            endTime,
            duration,
          };
          trs.push(tr);
        }
      }
    }
  });

  return trs;
}
