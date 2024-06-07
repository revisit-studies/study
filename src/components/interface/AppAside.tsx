import {
  Aside,
  CloseButton,
  ScrollArea,
  Switch,
  Text,
} from '@mantine/core';
import React, { useMemo } from 'react';
import { ComponentBlockWithOrderPath, StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { useCurrentComponent } from '../../routes/utils';
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

  const currentComponent = useCurrentComponent();
  const studyConfig = useStudyConfig();
  const dispatch = useStoreDispatch();

  const [participantView, setParticipantView] = React.useState(true);

  const fullOrder = useMemo(() => {
    let r = deepCopy(studyConfig.sequence) as ComponentBlockWithOrderPath;
    r = addPathToComponentBlock(r, 'root') as ComponentBlockWithOrderPath;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  return showStudyBrowser || (currentComponent === 'end' && studyConfig.uiConfig.autoDownloadStudy) ? (
    <Aside p="0" width={{ base: 360 }} style={{ zIndex: 0 }}>
      <Aside.Section sx={(theme) => ({ borderBottom: `1px solid ${theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[2]}` })}>
        <CloseButton
          style={{
            position: 'absolute', right: '10px', top: '10px', zIndex: 5,
          }}
          onClick={() => dispatch(toggleStudyBrowser())}
        />
        <Text size="md" p="sm" pb={2} weight="bold">
          Study Browser
        </Text>
        <Switch
          checked={participantView}
          onChange={(event) => setParticipantView(event.currentTarget.checked)}
          size="xs"
          pt={0}
          pb="sm"
          label="Participant View"
        />

      </Aside.Section>

      <Aside.Section grow component={ScrollArea} p="xs">
        <StepsPanel configSequence={fullOrder} participantSequence={sequence} fullSequence={sequence} participantView={participantView} />
      </Aside.Section>
    </Aside>
  ) : null;
}
