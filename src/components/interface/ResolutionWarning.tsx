import {
  Button, Modal, Text, Title, Group, Stack,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useStoreSelector } from '../../store/store';

export function ResolutionWarning() {
  const navigate = useNavigate();
  const studyConfig = useStoreSelector((state) => state.config);

  const minWidth = studyConfig.uiConfig.minWidthSize!;
  const minHeight = studyConfig.uiConfig.minHeightSize!;

  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < minWidth || window.innerHeight < minHeight) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minWidth, minHeight]);

  if (!showWarning) {
    return null;
  }

  return (
    <Modal opened withCloseButton={false} onClose={() => { }} fullScreen>
      <Stack align="center" justify="center" m="xl">
        <IconAlertTriangle size={64} color="orange" />
        <Title order={2}>Screen Resolution Warning</Title>
        <Text size="md" ta="center">
          Your screen resolution is below the minimum requirement (
          {minWidth}
          {' '}
          x
          {' '}
          {minHeight}
          ).
        </Text>
        <Text size="md" ta="center">
          Some content may not display correctly. Please use a device with a larger screen or resize your browser window.
        </Text>
        <Group mt="lg">
          <Button color="yellow" onClick={() => { setShowWarning(false); }} variant="outline">
            Continue anyway
          </Button>
          <Button onClick={() => navigate('/')} variant="filled">
            Go to main page
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
