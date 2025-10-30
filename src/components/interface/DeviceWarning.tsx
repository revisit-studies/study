import {
  Modal, Text, Title, Stack, List,
  Card,
  Flex,
} from '@mantine/core';
import {
  IconAlertTriangle, IconBrowser, IconDevices, IconHandClick,
} from '@tabler/icons-react';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useDeviceRules } from '../../store/hooks/useDeviceRules';

export function DeviceWarning() {
  const studyConfig = useStudyConfig();

  const { browserRules, deviceRules, inputRules } = studyConfig.uiConfig;

  const { isBrowserAllowed, isDeviceAllowed, isInputAllowed } = useDeviceRules(studyConfig.uiConfig);

  if (isBrowserAllowed && isDeviceAllowed && isInputAllowed) {
    return null;
  }

  return (
    <Modal opened onClose={() => {}} fullScreen withCloseButton={false}>
      <Stack align="center" justify="center">
        <IconAlertTriangle size={64} color="orange" />
        <Title order={3}> Browser or Device Not Supported </Title>

        <Flex my="lg" wrap="wrap" justify="center">
          {!isBrowserAllowed && (
          <Card shadow="sm" padding="lg" radius="md" mx="md" my="md" withBorder w={400}>
            <Card.Section bg="gray.3" mb="md" p="md" style={{ display: 'flex', justifyContent: 'center' }}>
              <IconBrowser size={48} color="gray" />
            </Card.Section>
            {browserRules?.blockedMessage
              ? (
                <Text size="md">
                  {browserRules.blockedMessage}
                </Text>
              ) : (
                <>
                  <Text size="md">
                    This study only works in the following browser(s):
                  </Text>
                  <List ml="md">
                    {browserRules?.allowed.map((browser, idx) => (
                      <List.Item key={idx}>
                        {browser.name}
                        {browser.minVersion && ` v${browser.minVersion} or later`}
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
          </Card>
          )}

          {!isDeviceAllowed && (
          <Card shadow="sm" padding="lg" radius="md" mx="md" my="md" withBorder w={400}>
            <Card.Section bg="gray.3" mb="md" p="md" style={{ display: 'flex', justifyContent: 'center' }}>
              <IconDevices size={48} color="gray" />
            </Card.Section>
            {deviceRules?.blockedMessage
              ? (
                <Text size="md">
                  {deviceRules.blockedMessage}
                </Text>
              ) : (
                <>
                  <Text size="md">
                    This study only works in the following device(s):
                  </Text>
                  <List ml="md">
                    {deviceRules?.allowed.map((device, idx) => (
                      <List.Item key={idx}>
                        {device}
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
          </Card>
          )}

          {!isInputAllowed && (
          <Card shadow="sm" padding="lg" radius="md" mx="md" my="md" withBorder w={400}>
            <Card.Section bg="gray.3" mb="md" p="md" style={{ display: 'flex', justifyContent: 'center' }}>
              <IconHandClick size={48} color="gray" />
            </Card.Section>
            {inputRules?.blockedMessage
              ? (
                <Text size="md">
                  {inputRules.blockedMessage}
                </Text>
              ) : (
                <>
                  <Text size="md">
                    This study only works on devices that support following input type(s):
                  </Text>
                  <List ml="md">
                    {inputRules?.allowed.map((input, idx) => (
                      <List.Item key={idx}>
                        {input}
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
          </Card>
          )}
        </Flex>
        <Text size="md" ta="center">
          Please reopen the study link in one of the browsers/device listed above.
          <br />
          Thank you for your understanding!
        </Text>
      </Stack>
    </Modal>
  );
}
