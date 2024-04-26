import {
  Container, Title, Text, Center, Anchor,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export default function StudyNotFound() {
  const navigate = useNavigate();

  return (
    <Container pt={100}>
      <Center>
        <Title order={3}>
          <Text span c="orange">Study ID</Text>
          {' '}
          not Found, plase check valid Study ID on your global config, or visit the
          {' '}
          <Anchor onClick={() => navigate('/')}>Landing Page</Anchor>
        </Title>
      </Center>
    </Container>
  );
}
