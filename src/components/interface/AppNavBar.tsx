import { Navbar, Text } from '@mantine/core';

export default function AppNavBar() {
  return (
    <Navbar p="md" width={{ lg: 300 }} style={{ zIndex: 0 }}>
      <Text>Application navbar</Text>
    </Navbar>
  );
}
