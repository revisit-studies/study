import {
  Aside,
  ScrollArea,
  Text,
} from '@mantine/core';
import { DownloadPanel } from '../DownloadPanel';
import { StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoreSelector } from '../../store/store';
import React, { useMemo } from 'react';
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

  if (!showAdmin) {
    return null;
  }

  return (
    <Aside p="0" width={{ base: 400 }} style={{ zIndex: 0 }}>
      <ScrollArea p="0">
        <Text size={'md'} p={10} weight={'bold'}>
          Study Sequence
        </Text>
        <StepsPanel order={fullOrder} sequence={sequence} />
        <div
          style={{ padding: 10, marginTop: 10, borderTop: '1px solid #e9ecef' }}
        >
          {currentStep === 'end' && (
            <>
              <Text size={'md'} p={10} weight={'bold'}>
                Download
              </Text>
              <DownloadPanel studyConfig={studyConfig} />
            </>
          )}
        </div>
      </ScrollArea>
    </Aside>
  );
}
