import { Center, Flex, Text } from '@mantine/core';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import {useEffect} from 'react';
import {useFirebase} from '../storage/init';
import {useCreatedStore} from '../store/store';

export function StudyEnd() {
  const config = useStudyConfig();
  const firebase = useFirebase();
  const { trrack } = useCreatedStore();

  useEffect(() => {
    async function fn() {
      await firebase.completeSession(trrack.root.id);
    }

    fn();
  }, []);

  return (
    <>
      <Center style={{ height: '100%' }}>
        <Flex direction="column">
          <Center>
            <Text size="xl" display="block">
              {config.uiConfig.studyEndMsg
                ? config.uiConfig.studyEndMsg
                : 'Thank you for completing the study. You may close this window now.'}
            </Text>
          </Center>
        </Flex>
      </Center>
    </>
  );
}
