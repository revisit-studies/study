import {
  Box,
  Button,
  CloseButton,
  Flex,
  ScrollArea,
  Tabs,
  Text,
  AppShell,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  IconBrandFirebase, IconBrandSupabase, IconDatabase, IconGraph, IconGraphOff, IconInfoCircle, IconSettingsShare, IconUserPlus,
} from '@tabler/icons-react';
import { useHref } from 'react-router';
import { ComponentBlockWithOrderPath, StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { useStudyId } from '../../routes/utils';
import { getNewParticipant } from '../../utils/nextParticipant';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { addPathToComponentBlock } from '../../utils/getSequenceFlatMap';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';

const AR_LABELS = {
  studyBrowser: 'متصفح الدراسة',
  nextParticipant: 'المشارك التالي',
  nextParticipantTooltip: 'الانتقال إلى تسلسل المشارك التالي في التجربة. قد تختلف التسلسلات بين المشاركين بسبب العشوائية وما إلى ذلك.',
  studyStatus: 'حالة الدراسة:',
  collectingData: 'جمع البيانات',
  dataCollectionDisabled: 'جمع البيانات معطّل',
  editSettings: 'تعديل إعدادات الدراسة',
  analyticsPublic: 'واجهة التحليلات متاحة للعموم',
  analyticsNotPublic: 'واجهة التحليلات غير متاحة للعموم',
  localStorageEnabled: 'التخزين المحلي مفعّل',
  firebaseEnabled: 'Firebase مفعّل',
  supabaseEnabled: 'Supabase مفعّل',
  unknownStorage: 'محرك تخزين غير معروف',
  cannotClose: 'لا يمكن إغلاق متصفح الدراسة في وضع إعادة التشغيل',
  participantView: 'عرض المشارك',
  participantViewInfo: 'يعرض هذا العرض العناصر كما يراها المشارك، مع مراعاة العشوائية والحذف وما إلى ذلك. يمكنك التنقل بين المشاركين باستخدام زر المشارك التالي.',
  allTrialsView: 'عرض جميع التجارب',
  allTrialsViewInfo: 'يعرض هذا العرض جميع العناصر بالترتيب المحدد في الإعدادات.',
};

function InfoHover({ text }: { text: string }) {
  return (
    <Tooltip label={text} multiline w={200} style={{ whiteSpace: 'normal' }} withinPortal position="bottom">
      <IconInfoCircle size={16} style={{ marginBottom: -3, marginLeft: 4 }} />
    </Tooltip>
  );
}

export function AppAside() {
  const sequence = useStoreSelector((state) => state.sequence);
  const { toggleStudyBrowser } = useStoreActions();

  const studyConfig = useStudyConfig();
  const dispatch = useStoreDispatch();

  const studyId = useStudyId();
  const isArabic = studyId === 'rtl-exp-ar';
  const L = isArabic ? AR_LABELS : null;
  const studyHref = useHref(`/${studyId}`);

  const { storageEngine } = useStorageEngine();

  const isAnalysis = useIsAnalysis();

  const fullOrder = useMemo(() => {
    let r = structuredClone(studyConfig.sequence) as ComponentBlockWithOrderPath;
    r = addPathToComponentBlock(r, 'root') as ComponentBlockWithOrderPath;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  const [activeTab, setActiveTab] = useState<string | null>('participant');

  const nextParticipantDisabled = useMemo(() => activeTab === 'allTrials' || isAnalysis, [activeTab, isAnalysis]);

  const modes = useStoreSelector((state) => state.modes);

  return (
    <AppShell.Aside className="studyBrowser" p="0">
      <AppShell.Section
        p="sm"
        pb={0}
      >
        <Flex direction="row" justify="space-between">
          <Text size="md" fw={700} pt={3}>
            {L?.studyBrowser ?? 'Study Browser'}
          </Text>
          <Tooltip label={L?.nextParticipantTooltip ?? 'Go to the sequence of the next participant in the experiment. Sequences can be different between participants due to randomization, etc.'} w={280} multiline disabled={nextParticipantDisabled}>
            <Button
              variant="light"
              leftSection={<IconUserPlus size={14} />}
              onClick={() => getNewParticipant(storageEngine, studyHref)}
              size="xs"
              disabled={nextParticipantDisabled}
            >
              {L?.nextParticipant ?? 'Next Participant'}
            </Button>
          </Tooltip>
          {isAnalysis ? (
            <Tooltip
              label={L?.cannotClose ?? 'The study browser cannot be closed in replay mode'}
              withinPortal
            >
              <CloseButton
                onClick={() => dispatch(toggleStudyBrowser())}
                mt={1}
                disabled={isAnalysis}
              />
            </Tooltip>
          ) : (
            <CloseButton
              onClick={() => dispatch(toggleStudyBrowser())}
              mt={1}
              disabled={isAnalysis}
            />
          )}
        </Flex>
        <Flex direction="row" justify="space-between" align="center" mt="xs" opacity={0.7}>
          <Text size="sm">
            {L?.studyStatus ?? 'Study Status:'}
            {' '}
            {modes?.dataCollectionEnabled ? (L?.collectingData ?? 'Collecting Data') : (L?.dataCollectionDisabled ?? 'Data Collection Disabled')}
          </Text>
          <Flex gap="sm" align="center">
            <Tooltip label={L?.editSettings ?? 'Edit Study Settings'} withinPortal position="bottom">
              <ActionIcon
                variant="white"
                aria-label="Edit Study Modes"
                component="a"
                href={useHref(`/analysis/stats/${studyId}/manage`)}
                p={0}
              >
                <IconSettingsShare style={{ width: '70%', height: '70%' }} stroke={1.5} size={16} />
              </ActionIcon>
            </Tooltip>
            {modes?.analyticsInterfacePubliclyAccessible
              ? <Tooltip label={L?.analyticsPublic ?? 'Analytics interface publicly accessible'} multiline w={200} style={{ whiteSpace: 'normal' }} withinPortal position="bottom"><IconGraph size={16} color="green" /></Tooltip>
              : <Tooltip label={L?.analyticsNotPublic ?? 'Analytics interface not publicly accessible'} multiline w={200} style={{ whiteSpace: 'normal' }} withinPortal position="bottom"><IconGraphOff size={16} color="red" /></Tooltip>}
            {storageEngine?.getEngine() === 'localStorage'
              ? <Tooltip label={L?.localStorageEnabled ?? 'Local storage enabled'} withinPortal position="bottom"><IconDatabase size={16} color="green" /></Tooltip>
              : storageEngine?.getEngine() === 'firebase'
                ? <Tooltip label={L?.firebaseEnabled ?? 'Firebase enabled'} withinPortal position="bottom"><IconBrandFirebase size={16} color="green" /></Tooltip>
                : storageEngine?.getEngine() === 'supabase'
                  ? <Tooltip label={L?.supabaseEnabled ?? 'Supabase enabled'} withinPortal position="bottom"><IconBrandSupabase size={16} color="green" /></Tooltip>
                  : <Tooltip label={L?.unknownStorage ?? 'Unknown storage engine enabled'} withinPortal position="bottom"><IconDatabase size={16} color="red" /></Tooltip>}
          </Flex>
        </Flex>
      </AppShell.Section>

      <AppShell.Section
        grow
        component={ScrollArea}
        p="xs"
        pt={4}
      >
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Box style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'white',
            zIndex: 1,
          }}
          >
            <Tabs.List grow>
              <Tabs.Tab value="participant">
                {L?.participantView ?? 'Participant View'}
                <InfoHover text={L?.participantViewInfo ?? 'The Participants View shows items just as a participants would see them, considering randomization, omissions, etc. You can navigate between multiple participants using the next participant button.'} />
              </Tabs.Tab>
              <Tabs.Tab value="allTrials" disabled={isAnalysis}>
                {L?.allTrialsView ?? 'All Trials View'}
                <InfoHover text={L?.allTrialsViewInfo ?? 'The All Trials View shows all items in the order defined in the config.'} />
              </Tabs.Tab>
            </Tabs.List>
          </Box>

          <Tabs.Panel value="participant">
            <StepsPanel configSequence={fullOrder} participantSequence={sequence} fullSequence={sequence} participantView studyConfig={studyConfig} />
          </Tabs.Panel>
          <Tabs.Panel value="allTrials">
            <StepsPanel configSequence={fullOrder} participantSequence={sequence} fullSequence={sequence} participantView={false} studyConfig={studyConfig} />
          </Tabs.Panel>
        </Tabs>
      </AppShell.Section>
    </AppShell.Aside>
  );
}
