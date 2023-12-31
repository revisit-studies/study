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
import { OrderObject } from '../../parser/types';
import { deepCopy } from '../../utils/deepCopy';

/**
 * Recursively search and return first child component
 */
const getFirstChildComponent = (orderObj: OrderObject): string => {
  if (typeof orderObj.components[0] === 'string') {
    return orderObj.components[0] as string;
  }
  return getFirstChildComponent(orderObj.components[0] as OrderObject);
};

/**
 * Returns an order object according to the sequence provided for the participant
 */
const getFullOrder = (sequence: string[], orderObj: OrderObject) => {
  const order = deepCopy(orderObj);

  order.components.sort((a, b) => {
    const keyA = typeof a === 'string' ? a : getFirstChildComponent(a);
    const keyB = typeof b === 'string' ? b : getFirstChildComponent(b);
    return sequence.indexOf(keyA) - sequence.indexOf(keyB);
  });

  order.components = order.components.map((c) => {
    if (typeof c === 'string') {
      return c;
    }
    return getFullOrder(sequence, c);
  });

  return order;
};

export default function AppAside() {
  const { showAdmin, sequence } = useStoreSelector((state) => state);

  const currentStep = useCurrentStep();
  const studyConfig = useStudyConfig();

  const fullOrder = useMemo(() => {
    const r = getFullOrder(sequence, studyConfig.sequence);
    r.components.push('end');
    return r;
  }, [sequence, studyConfig.sequence]);

  if (!showAdmin) {
    return null;
  }

  return (
    <Aside p="0" width={{ base: 400 }} style={{ zIndex: 0 }}>
      <ScrollArea p="0">
        <Text size={'md'} p={10} weight={'bold'}>
          Study Sequence
        </Text>
        <StepsPanel order={fullOrder} />
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
