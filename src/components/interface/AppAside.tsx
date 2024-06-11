import {
  CloseButton,
  ScrollArea,
  Switch,
  Text,
  AppShell,
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
    <AppShell.Aside style={{ zIndex: 0 }}>
      <AppShell.Section style={(theme) => ({ borderBottom: '1px solid --mantine-color-gray-2' })}>
        <CloseButton
          style={{
            position: 'absolute', right: '10px', top: '10px', zIndex: 5,
          }}
          onClick={() => dispatch(toggleStudyBrowser())}
        />
        <Text size="md" p="sm" pb={2} style={{ weight: 'bold' }}>
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

      </AppShell.Section>

      <AppShell.Section grow component={ScrollArea} p="xs">
        <StepsPanel configSequence={fullOrder} participantSequence={sequence} fullSequence={sequence} participantView={participantView} />
      </AppShell.Section>
    </AppShell.Aside>
  ) : null;
}
