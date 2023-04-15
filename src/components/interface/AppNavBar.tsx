import { Button, Flex, Navbar, NumberInput, Space, Text, Textarea } from '@mantine/core';

export default function AppNavBar() {
  const trialHasSideBar = true;
  const trialHasSideBarResponses = true;
  const trialHasSideBarUI = false;

  return trialHasSideBar ? (
    <Navbar width={{ lg: 300 }} style={{ zIndex: 0 }}>
      <Navbar.Section bg="gray.3" p="xl">
        <Text c="gray.9"><Text span c="orange.8" fw={700} inherit>Task 8:</Text> Task Instructions</Text>
      </Navbar.Section>

      {trialHasSideBarResponses && 
      <Navbar.Section bg="gray.1" p="xl" grow>
        <NumberInput></NumberInput>

        <Space h="xl"></Space>

        <Textarea
          label="Please explain your answer below"
          placeholder="Type something..."
          minRows={5}
        ></Textarea>

        <Space h="xl"></Space>

        <Flex justify="end"><Button>Submit</Button></Flex>
      </Navbar.Section>}

      {trialHasSideBarUI && 
      <Navbar.Section p="xl">
        <div id="sidebar-ui"></div>
      </Navbar.Section>}
    </Navbar>
  ) : null;
}
