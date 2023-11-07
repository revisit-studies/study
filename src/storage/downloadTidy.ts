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
  const sessionArr = await getAllSessions(fb.firestore, studyId);

  const rows = sessionArr
    .filter(
      (sessionObject) =>
        sessionObject.session.status.endStatus?.status === 'completed'
    )
    .map((sessionObject) => processToRow(sessionObject, trialIds))
    .flat();

  const escapeDoubleQuotes = (s: string) => s.replace(/"/g, '""');

  const csvRows = rows.map((row) =>
    properties
      .map((header) => {
        if (row === null) {
          return '';
        } else if (typeof row[header] === 'string') {
          return `"${escapeDoubleQuotes(row[header])}"`;
        } else {
          return JSON.stringify(row[header]);
        }
      })
      .join(',')
  );

  const csv = [properties.join(','), ...csvRows].join('\n');

  download(csv, filename);
}

function processToRow(
  {
    graph,
    session,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    graph: ProvenanceGraph<any, any, any>;
    session: FsSession;
  },
  trialIds: string[]
): Array<TidyRow> | null {
  const trs: Array<TidyRow> = [];

  const nodes = Object.values(graph.nodes);
  nodes.sort((a, b) => a.meta.createdOn - b.meta.createdOn);

  if (nodes.length < 3) {
    return null;
  }

  const lastNode = nodes[nodes.length - 1];

  const study = lastNode.state.val.trrackedSlice;
  const { config } = lastNode.state.val.unTrrackedSlice;

  trialIds.forEach((trialId) => {
    const trial = study[trialId];
    if (trial) {
      const answer: Nullable<TrialResult> = 'answer' in trial ? trial : null;
      const startTime = answer?.startTime
        ? new Date(answer.startTime).toUTCString()
        : null;
      const endTime = answer?.endTime
        ? new Date(answer.endTime).toUTCString()
        : null;
      const duration = (answer?.endTime || 0) - (answer?.startTime || 0);

      const trialConfig = config.components[trialId];

      const answers: { [key: string]: string } = answer?.answer as {
        [key: string]: string;
      };
      for (const key in answers) {
        if (Object.prototype.hasOwnProperty.call(answers, key)) {
          const answerField = key.split('/').filter((f) => f.length > 0);
          const tr: TidyRow = {
            pid: study.studyIdentifiers.pid,
            sessionId: study.studyIdentifiers.session_id,
            status: session.status.endStatus?.status || 'incomplete',
            trialId,
            answer: answers[key],
            studyId: answerField[0],
            measure: answerField[2],
            correctAnswer:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              trialConfig.response.find((a: any) => a.id === answerField[2])
                ?.correctAnswer || '',
            description: trial.description,
            instruction: trialConfig.instruction,
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
