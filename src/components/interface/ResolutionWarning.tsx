import {
  Modal, Text, Title, Stack,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useStoreSelector } from '../../store/store';

export function ResolutionWarning() {
  const studyConfig = useStoreSelector((state) => state.config);

  const minWidth = studyConfig.uiConfig.minWidthSize;
  const minHeight = studyConfig.uiConfig.minHeightSize;

  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const widthTooSmall = minWidth != null && window.innerWidth < minWidth;
      const heightTooSmall = minHeight != null && window.innerHeight < minHeight;
      setShowWarning(widthTooSmall || heightTooSmall);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minWidth, minHeight]);

  if (!showWarning) {
    return null;
  }

  return (
    <Modal opened={showWarning} onClose={() => {}} fullScreen withCloseButton={false}>
      <Stack align="center" justify="center">
        <IconAlertTriangle size={64} color="orange" />
        <Title order={3}> Screen Resolution Warning </Title>
        <Text size="md" ta="center">
          Your screen resolution is below the minimum requirement:
          <br />
          {minWidth !== undefined && ` Width: ${minWidth}px`}
          {minHeight !== undefined && ` Height: ${minHeight}px`}
        </Text>
        <Text size="md" ta="center">
          Some content may not display correctly. Please use a device with a larger screen or resize your browser window.
        </Text>
      </Stack>
    </Modal>
  );
}
