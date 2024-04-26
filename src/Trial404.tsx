import {
  Center, Container, Text, Title,
} from '@mantine/core';

export default function TrialNotFound() {
  return (
    <Container pt={100}>
      <Center>
        <Title order={3}>
          <Text span c="orange">Trial</Text>
          {' '}
          not found, please check your URL
        </Title>
      </Center>
    </Container>
  );
}
