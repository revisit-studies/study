import {
  Anchor,
  Center, Container, Title,
} from '@mantine/core';

export default function TrialNotFound(props:{email: string}) {
  const { email } = props;

  return (
    <Container pt={100}>
      <Center>
        <Title order={3}>
          Trial not found, please contact the administrator at
          {' '}
          <Anchor c="blue" href={`mailto:${email}`}>
            {email}
            {' '}
          </Anchor>
        </Title>
      </Center>
    </Container>
  );
}
