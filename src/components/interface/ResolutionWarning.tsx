import {
  Button, Modal, Text, Alert,
} from '@mantine/core';
import {
  useEffect, useState,
} from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import {
  useStoreSelector,
} from '../../store/store';

export function ResolutionWarning() {
  const [showWarning, setShowWarning] = useState(false);

  const navigate = useNavigate();
  const studyConfig = useStoreSelector((state) => state.config);

  const minWidth = studyConfig?.uiConfig?.minWidthSize || 1024;
  const minHeight = studyConfig?.uiConfig?.minHeightSize || 768;

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
      <Alert
        color="red"
        radius="lg"
        icon={<IconAlertTriangle />}
        onClose={() => { }}
        styles={{ root: { backgroundColor: 'unset' } }}
      />
      <Text>Screen Resolution Warning</Text>
      <Text>
        Your screen resolution is below the minimum requirement (
        {minWidth}
        x
        {minHeight}
        ).
      </Text>
      <Text>
        Please use a device with a larger screen or resize your browser window.
      </Text>

      <Button
        onClick={() => navigate('/')}
        size="xs"
        variant="outline"
      >
        Return to main page
      </Button>

    </Modal>
  );
}
