import {
  Aside,
  ScrollArea,
  Text,
} from '@mantine/core';
import React, { useMemo } from 'react';
import { DownloadPanel } from '../DownloadPanel';
import { OrderObjectWithOrderPath, StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useFlatSequence, useStoreSelector } from '../../store/store';
import { useCurrentStep } from '../../routes/utils';
import { deepCopy } from '../../utils/deepCopy';
import { OrderObject } from '../../parser/types';

function addPathToOrderObject(order: OrderObject | string, orderPath: string): (OrderObject & { orderPath: string }) | string {
  if (typeof order === 'string') {
    return order;
  }
  return { ...order, orderPath, components: order.components.map((o, i) => addPathToOrderObject(o, `${orderPath}-${i}`)) };
}

export default function AppAside() {
  const { showAdmin, sequence } = useStoreSelector((state) => state);

  const currentStep = useCurrentStep();
  const currentComponent = useFlatSequence()[currentStep];
  const studyConfig = useStudyConfig();

  const fullOrder = useMemo(() => {
    let r = deepCopy(studyConfig.sequence) as OrderObjectWithOrderPath;
    r = addPathToOrderObject(r, 'root') as OrderObjectWithOrderPath;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  return showAdmin || (currentComponent === 'end' && studyConfig.uiConfig.autoDownloadStudy) ? (
    <Aside p="0" width={{ base: 300 }} style={{ zIndex: 0 }}>
      <ScrollArea p="0">
        {currentComponent === 'end' && (
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
        <StepsPanel configSequence={fullOrder} participantSequence={sequence} fullSequence={sequence} />
      </ScrollArea>
    </Aside>
  ) : null;
}
