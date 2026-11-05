import {
  Flex, Switch, Text, Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { showNotification } from '../../../utils/notifications';

export function StudyVisibilityItem({ studyId }: { studyId: string }) {
  const { storageEngine, configuredStorageEngine } = useStorageEngine();
  const visibilityEngine = configuredStorageEngine ?? storageEngine;
  const [asyncStatus, setAsyncStatus] = useState(false);
  const [showStudyEnabled, setShowStudyEnabled] = useState(false);
  const activeRequest = useRef({ cancelled: false, saving: false });

  useEffect(() => {
    const request = { cancelled: false, saving: false };
    activeRequest.current = request;
    setAsyncStatus(false);

    const fetchData = async () => {
      if (visibilityEngine) {
        try {
          const hidden = await visibilityEngine.getStudyHiddenFromLandingPage(studyId);
          if (!request.cancelled) {
            setShowStudyEnabled(!hidden);
            setAsyncStatus(true);
          }
        } catch {
          if (!request.cancelled) {
            showNotification({
              title: 'Unable to load study visibility',
              message: 'Refresh the page to try again.',
              color: 'red',
            });
          }
        }
      }
    };
    fetchData();

    return () => { request.cancelled = true; };
  }, [visibilityEngine, studyId]);

  const handleChange = async (enabled: boolean) => {
    const request = activeRequest.current;
    if (!visibilityEngine || !asyncStatus || request.saving) return;
    request.saving = true;

    try {
      await visibilityEngine.setStudyHiddenFromLandingPage(studyId, !enabled);
      if (!request.cancelled) setShowStudyEnabled(enabled);
    } catch {
      if (!request.cancelled) {
        showNotification({
          title: 'Unable to save study visibility',
          message: 'Your setting was not changed. Please try again.',
          color: 'red',
        });
      }
    } finally {
      request.saving = false;
    }
  };

  return (
    asyncStatus && (
      <>
        <Title order={4} mb="sm">Study visibility</Title>
        <Flex gap="xs">
          <Title order={5}>Show study on landing page</Title>
          <Switch
            size="sm"
            aria-label="Show study on landing page"
            checked={showStudyEnabled}
            onChange={(event) => handleChange(event.currentTarget.checked)}
            mt="3px"
          />
        </Flex>
        <Text>By default, all available studies are publicly visible to anyone visiting the root of your study page. Disable this if you want to hide it, so that, for example, participants cannot find other conditions by deleting part of the path of the URL. We recommend turning this back on after your study is completed.</Text>
      </>
    )
  );
}
