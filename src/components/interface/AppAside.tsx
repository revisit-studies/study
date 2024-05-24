import {
  Aside,
  CloseButton,
  ScrollArea,
  Text,
} from '@mantine/core';
import React, { useMemo } from 'react';
import { ComponentBlockWithOrderPath, StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import {
  useFlatSequence, useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { useCurrentStep } from '../../routes/utils';
import { deepCopy } from '../../utils/deepCopy';
import { ComponentBlock } from '../../parser/types';

function addPathToComponentBlock(order: ComponentBlock | string, orderPath: string): (ComponentBlock & { orderPath: string }) | string {
  if (typeof order === 'string') {
    return order;
  }
  return { ...order, orderPath, components: order.components.map((o, i) => addPathToComponentBlock(o, `${orderPath}-${i}`)) };
}

export default function AppAside() {
  const { showStudyBrowser, sequence } = useStoreSelector((state) => state);
  const { toggleStudyBrowser } = useStoreActions();

  const currentStep = useCurrentStep();
  const currentComponent = useFlatSequence()[currentStep];
  const studyConfig = useStudyConfig();
  const dispatch = useStoreDispatch();

  const fullOrder = useMemo(() => {
    let r = deepCopy(studyConfig.sequence) as ComponentBlockWithOrderPath;
    r = addPathToComponentBlock(r, 'root') as ComponentBlockWithOrderPath;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  return showStudyBrowser || (currentComponent === 'end' && studyConfig.uiConfig.autoDownloadStudy) ? (
    <Aside p="0" width={{ base: 300 }} style={{ zIndex: 0 }}>
      <Aside.Section>
        <CloseButton
          style={{
            position: 'absolute', right: '10px', top: '10px', zIndex: 5,
          }}
          onClick={() => dispatch(toggleStudyBrowser())}
        />
        <Text size="md" p={10} weight="bold">
          Study Browser
        </Text>
      </Aside.Section>

      <Aside.Section grow component={ScrollArea}>
        <StepsPanel configSequence={fullOrder} participantSequence={sequence} fullSequence={sequence} />
      </Aside.Section>
    </Aside>
  ) : null;
}
