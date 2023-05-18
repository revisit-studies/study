import { Center, Flex, Text } from '@mantine/core';
import { useStudyConfig } from '../store/hooks/useStudyConfig';

export function StudyEnd() {
  const config = useStudyConfig();

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
