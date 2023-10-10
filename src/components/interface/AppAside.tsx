import {
  Aside,
  Space,
} from '@mantine/core';
import { useCurrentStep } from '../../routes';
import { useFlagsSelector } from '../../store/flags';
import { DownloadPanel } from '../DownloadPanel';
import { StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';

export default function AppAside() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showAdmin = useFlagsSelector((state: any) => state.showAdmin);

  const step = useCurrentStep();

  const studyConfig = useStudyConfig();

  return showAdmin ? (
    <Aside p="md" width={{ base: 300 }} style={{ zIndex: 0 }}>
      <StepsPanel order={studyConfig.sequence} />

      <Space h="md" />

      {step === 'end' && <DownloadPanel />}
    </Aside>
  ) : null;
}
