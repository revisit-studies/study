import { Prettify } from '../parser/types';
import { getAllParticipants } from './queries';

type Firebase = any;

export const OPTIONAL_COMMON_PROPS = [
  'description',
  'instruction',
  'duration',
  'answer',
  'correctAnswer',
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

export type ParticipantLoadOptions = 'all' | 'recent' | 'first' | 'last';
export type ParticipantLoadQuery = {
  value: ParticipantLoadOptions;
  label: string;
  count?: number;
};

export const PARTICIPANT_LOAD_OPTS: ParticipantLoadQuery[] = [
  {
    value: 'all',
    label: 'All',
  },
  {
    value: 'recent',
    label: 'Last active',
    count: 10,
  },
  {
    value: 'first',
    label: 'First',
    count: 10,
  },
  {
    value: 'last',
    label: 'Last',
    count: 10,
  },
];

export async function downloadTidy(
  fb: Firebase,
  _trialGroups: string[],
  _properties: Property[] = [...REQUIRED_PROPS, ...OPTIONAL_COMMON_PROPS],
  _participantLoadQuery: ParticipantLoadQuery = PARTICIPANT_LOAD_OPTS[0]
) {
  const fbReady = fb.ready;
  if (!fbReady) return;

  const { firestore, studyId } = await fbReady;

  await getAllParticipants(firestore, studyId);
}
