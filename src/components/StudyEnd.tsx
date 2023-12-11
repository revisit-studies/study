import { Center, Flex, Loader, Space, Text } from '@mantine/core';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import ReactMarkdownWrapper from './ReactMarkdownWrapper';
import { disableBrowserBack } from '../utils/disableBrowserBack';
import { useStorageEngine } from '../store/storageEngineHooks';
import { useEffect, useState } from 'react';


export function StudyEnd() {
  const config = useStudyConfig();
  const { storageEngine } = useStorageEngine();

  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    // verify that storageEngine.verifyCompletion() returns true, loop until it does
    const interval = setInterval(async () => {
      const isComplete = await storageEngine!.verifyCompletion();
      if (isComplete) {
        setCompleted(true);
        clearInterval(interval);
      }
    }, 1000);
  }, []);

  // Disable browser back button on study end
  disableBrowserBack();

  return (
      <>
        <Center style={{ height: '100%' }}>
          <Flex direction="column">
              {completed ? 
                <Text size="xl" display="block">
                  {config.uiConfig.studyEndMsg
                      ? <ReactMarkdownWrapper text={config.uiConfig.studyEndMsg} />
                      : 'Thank you for completing the study. You may close this window now.'}
                </Text>
              :
                <>
                  <Text size="xl" display="block">Please wait while your answers are uploaded.</Text>
                  <Space h="lg" />
                  <Center>
                    <Loader color="blue" />
                  </Center>
                </>
              }
          </Flex>
        </Center>
      </>
  );
}
