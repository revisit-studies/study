import {
  Center, Flex, Space, Text,
} from '@mantine/core';
import { useDisableBrowserBack } from '../utils/useDisableBrowserBack';

export function ScreenResolutionFailed() {
  // Disable browser back button on study end
  useDisableBrowserBack();

  return (
    <Center style={{ height: '100%' }}>
      <Flex direction="column">
        <Text size="xl" display="block">Please resize your browser window to the minimum required size. You may close this window now.</Text>
        <Space h="lg" />
      </Flex>
    </Center>
  );
}
