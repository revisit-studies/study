import {
  Container, Title, Text, Center,
} from '@mantine/core';

export default function StudyNotFound() {
  return (
    <Container pt={100}>
      <Center>
        <Title order={3}>
          <Text span c="orange">Study ID</Text>
          {' '}
          not Found, please check valid Study ID on your global config, or contact the administrator.
        </Title>
      </Center>
    </Container>
  );
}
