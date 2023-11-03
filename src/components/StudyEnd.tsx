import { Center, Flex, Text } from '@mantine/core';
import { useStudyConfig } from '../store/hooks/useStudyConfig';

export function StudyEnd() {
  const config = useStudyConfig();

  const generateMessage = (msg : string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Replace all matched links with an empty string
    const textWithoutLinks = msg.replace(urlRegex, '');
    const link =  msg.match(urlRegex) || [];
    return <>
      <p>{textWithoutLinks} </p>
      {link.length>0 && <a href={link[0]}>{link}</a>}
    </>;
  };

  return (
    <>
      <Center style={{ height: '100%' }}>
        <Flex direction="column">
          <Center>
            <Text size="xl" display="block">
              {config.uiConfig.studyEndMsg
                ? generateMessage(config.uiConfig.studyEndMsg)
                : 'Thank you for completing the study. You may close this window now.'}
            </Text>
          </Center>
        </Flex>
      </Center>
    </>
  );
}
