import {
  Anchor,
  Center, Container, Text, Title,
} from '@mantine/core';
import { StudyConfig } from './parser/types';

export default function TrialNotFound(props:{email: string}) {
  const { email } = props;

  return (
    <Container pt={100}>
      <Center>
        <Title order={3}>
          Trial not found, please contact the administrator at
          {' '}
          <Anchor span c="blue">
            {email}
            {' '}
          </Anchor>
        </Title>
      </Center>
    </Container>
  );
}
