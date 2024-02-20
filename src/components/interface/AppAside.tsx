import {
  Aside,
  ScrollArea,
  Text,
} from '@mantine/core';
import React, { useMemo } from 'react';
import { DownloadPanel } from '../DownloadPanel';
import { StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoreSelector } from '../../store/store';
import { useCurrentStep } from '../../routes';
import { deepCopy } from '../../utils/deepCopy';

export default function AppAside() {
  const { showAdmin, sequence } = useStoreSelector((state) => state);

  const currentStep = useCurrentStep();
  const studyConfig = useStudyConfig();

  const fullOrder = useMemo(() => {
    const r = deepCopy(studyConfig.sequence);
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  return showAdmin || (currentStep === 'end' && studyConfig.uiConfig.autoDownloadStudy) ? (
    <Aside p="0" width={{ base: 300 }} style={{ zIndex: 0 }}>
      <ScrollArea p="0">
        {currentStep === 'end' && (
          <div
            style={{ padding: 10, paddingBottom: 15, borderBottom: '1px solid #e9ecef' }}
          >
            <Text size="md" p={10} weight="bold">
              Download
            </Text>
            <DownloadPanel studyConfig={studyConfig} />
          </div>
        )}
        <Text size="md" p={10} weight="bold">
          Study Sequence
        </Text>
        <StepsPanel order={fullOrder} sequence={sequence} />
      </ScrollArea>
    </Aside>
  ) : null;
}
