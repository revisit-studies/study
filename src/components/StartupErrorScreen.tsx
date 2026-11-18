import {
  Button, Center, Code, Image, Paper, Stack, Text, Title,
} from '@mantine/core';
import { useEffect, useRef } from 'react';
import { PREFIX } from '../utils/Prefix';

export function getStartupErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return String(error);
}

export function StartupErrorScreen({
  error,
  showDetails = import.meta.env.DEV,
  onReload = () => window.location.reload(),
  actionLabel = 'Reload',
  onResetSession,
}: {
  error: unknown;
  showDetails?: boolean;
  onReload?: () => void;
  actionLabel?: string;
  /** When provided, offers to discard the stored participant session and start a new one. */
  onResetSession?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <Center mih="100vh" p="md">
      <Paper
        role="alert"
        aria-labelledby="startup-error-heading"
        withBorder
        shadow="md"
        p="xl"
        maw={520}
        w="100%"
      >
        <Stack align="center" gap="md">
          <Image
            src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`}
            alt=""
            aria-hidden="true"
            w={64}
          />
          <Title
            id="startup-error-heading"
            order={1}
            ref={headingRef}
            tabIndex={-1}
            ta="center"
          >
            ReVISit could not load
          </Title>
          <Text ta="center">
            Something went wrong while loading this page. Please reload and try again.
          </Text>
          <Button size="md" onClick={onReload}>
            {actionLabel}
          </Button>
          {onResetSession && (
            <>
              <Text ta="center" size="sm" c="dimmed">
                If this keeps happening, your saved progress in this study may be out of date.
                Starting a new session discards it.
              </Text>
              <Button size="md" variant="default" onClick={onResetSession}>
                Start a new session
              </Button>
            </>
          )}
          {showDetails && (
            <Code block w="100%" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {getStartupErrorDetails(error)}
            </Code>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
