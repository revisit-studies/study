import {
  Container, Title, Text, List,
  Space,
  Anchor,
} from '@mantine/core';
import { useLocation } from 'react-router';

export function ResourceNotFound({ email, path }: { email?: string, path?: string }) {
  const location = useLocation();
  return (
    <Container fluid my={50} maw={800} mx="auto">
      <Title order={2}>
        <Text span c="orange">404</Text>
      </Title>
      <Text>
        <Text span fw={700}>{path || location.pathname}</Text>
        {' '}
        not Found.
      </Text>

      <Space h="lg" />

      <List>
        <List.Item>
          <Text>
            If you&apos;re trying to access your study please check the URL and verify that the global config file is correctly configured. Then try again.
          </Text>
        </List.Item>
        <List.Item>
          <Text>
            If you&apos;re a participant, please contact the study administrator
            {' '}
            {email && (
              <>
                at
                {' '}
                <Anchor c="blue" href={`mailto:${email}`}>
                  {email}
                  {' '}
                </Anchor>
              </>
            )}
            .
          </Text>
        </List.Item>
      </List>
    </Container>
  );
}
