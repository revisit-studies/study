import {
  Modal, Text, Title, Stack, List,
  Card,
  Flex,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  IconAlertTriangle, IconBrowser, IconDevices, IconHandClick, IconDeviceDesktop,
} from '@tabler/icons-react';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useDeviceRules } from '../../store/hooks/useDeviceRules';

export function DeviceWarning() {
  const studyConfig = useStudyConfig();
  const { storageEngine } = useStorageEngine();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRejected, setIsRejected] = useState(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    browsers, devices, inputs, display,
  } = studyConfig.studyRules ?? {};
  const displayRules = [
    display?.minWidth !== undefined ? `Minimum width: ${display.minWidth}px` : undefined,
    display?.minHeight !== undefined ? `Minimum height: ${display.minHeight}px` : undefined,
    display?.maxWidth !== undefined ? `Maximum width: ${display.maxWidth}px` : undefined,
    display?.maxHeight !== undefined ? `Maximum height: ${display.maxHeight}px` : undefined,
  ].filter((rule): rule is string => rule !== undefined);

  const {
    isBrowserAllowed,
    isDeviceAllowed,
    isInputAllowed,
    isDisplayAllowed,
    currentBrowser,
    currentDevice,
    currentInputs,
    currentDisplay,
  } = useDeviceRules(studyConfig.studyRules);
  const isDisplayRequirementNotMet = !isDisplayAllowed && (
    (display?.minWidth !== undefined && currentDisplay.width < display.minWidth)
    || (display?.minHeight !== undefined && currentDisplay.height < display.minHeight)
  );

  useEffect(() => {
    if (isRejected) {
      return () => {};
    }

    if (isDisplayRequirementNotMet) {
      setTimeLeft(60);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      countdownIntervalRef.current = setInterval(() => {
        setTimeLeft((currentTime) => {
          if (currentTime <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }

            if (storageEngine) {
              setIsRejected(true);
              storageEngine.rejectCurrentParticipant('Screen resolution requirements not met')
                .catch(() => {
                  console.error('Failed to reject participant who failed display requirements');
                })
                .finally(() => {
                  navigate(`./../__trainingFailed${window.location.search}`);
                });
            } else {
              setIsRejected(true);
              navigate(`./../__trainingFailed${window.location.search}`);
            }

            return 0;
          }

          return currentTime - 1;
        });
      }, 1000);
    } else {
      setTimeLeft(60);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isDisplayRequirementNotMet, isRejected, navigate, storageEngine]);

  if (isBrowserAllowed && isDeviceAllowed && isInputAllowed && isDisplayAllowed && !isRejected) {
    return null;
  }

  return (
    <Modal opened onClose={() => {}} fullScreen withCloseButton={false}>
      <Stack align="center" justify="center">
        <IconAlertTriangle size={64} color="orange" />
        <Title order={3}> Browser, Device, Input, or Display Is Not Compatible </Title>
        {isRejected && (
          <Text size="md" ta="center" c="red">
            You have been rejected because your display size stayed outside
            the minimum requirements for 60 seconds.
          </Text>
        )}
        {!isRejected && isDisplayRequirementNotMet && (
          <Text size="md" ta="center" c="red">
            Please resize your browser window to the allowed range within
            {' '}
            {timeLeft}
            {' '}
            seconds or you will be rejected.
          </Text>
        )}
        <Flex wrap="wrap" justify="center">
          {!isBrowserAllowed && (
          <Card shadow="sm" padding="lg" radius="md" mx="md" my="md" withBorder w={400}>
            <Card.Section bg="gray.3" mb="md" p="md" style={{ display: 'flex', justifyContent: 'center' }}>
              <IconBrowser size={48} color="gray" />
            </Card.Section>
            <Text size="sm" c="dimmed" mb="sm">
              Current browser:
              {' '}
              {currentBrowser.name}
              {currentBrowser.version ? ` v${currentBrowser.version}` : ''}
            </Text>
            {browsers?.blockedMessage
              ? (
                <Text size="md">
                  {browsers.blockedMessage}
                </Text>
              ) : (
                <>
                  <Text size="md">
                    This study only works in the following browser(s):
                  </Text>
                  <List ml="md">
                    {browsers?.allowed.map((browser, idx) => (
                      <List.Item key={idx}>
                        {browser.name}
                        {browser.minVersion && ` v${browser.minVersion} or later`}
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
          </Card>
          )}

          {!isDeviceAllowed && (
          <Card shadow="sm" padding="lg" radius="md" mx="md" my="md" withBorder w={400}>
            <Card.Section bg="gray.3" mb="md" p="md" style={{ display: 'flex', justifyContent: 'center' }}>
              <IconDevices size={48} color="gray" />
            </Card.Section>
            <Text size="sm" c="dimmed" mb="sm">
              Current device:
              {' '}
              {currentDevice}
            </Text>
            {devices?.blockedMessage
              ? (
                <Text size="md">
                  {devices.blockedMessage}
                </Text>
              ) : (
                <>
                  <Text size="md">
                    This study only works in the following device(s):
                  </Text>
                  <List ml="md">
                    {devices?.allowed.map((device, idx) => (
                      <List.Item key={idx}>
                        {device}
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
          </Card>
          )}

          {!isInputAllowed && (
          <Card shadow="sm" padding="lg" radius="md" mx="md" my="md" withBorder w={400}>
            <Card.Section bg="gray.3" mb="md" p="md" style={{ display: 'flex', justifyContent: 'center' }}>
              <IconHandClick size={48} color="gray" />
            </Card.Section>
            <Text size="sm" c="dimmed" mb="sm">
              Current input:
              {' '}
              {currentInputs.length ? currentInputs.join(', ') : 'none detected'}
            </Text>
            {inputs?.blockedMessage
              ? (
                <Text size="md">
                  {inputs.blockedMessage}
                </Text>
              ) : (
                <>
                  <Text size="md">
                    This study only works on devices that support following input type(s):
                  </Text>
                  <List ml="md">
                    {inputs?.allowed.map((input, idx) => (
                      <List.Item key={idx}>
                        {input}
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
          </Card>
          )}

          {!isDisplayAllowed && (
            <Card shadow="sm" padding="lg" radius="md" mx="md" my="md" withBorder w={400}>
              <Card.Section bg="gray.3" mb="md" p="md" style={{ display: 'flex', justifyContent: 'center' }}>
                <IconDeviceDesktop size={48} color="gray" />
              </Card.Section>
              <Text size="sm" c="dimmed" mb="sm">
                Current display:
                {' '}
                {`${currentDisplay.width} x ${currentDisplay.height}px`}
              </Text>
              {display?.blockedMessage
                ? (
                  <Text size="md">
                    {display.blockedMessage}
                  </Text>
                ) : (
                  <>
                    <Text size="md">
                      This study only works on devices that support following display size(s):
                    </Text>
                    <List ml="md">
                      {displayRules.map((size) => (
                        <List.Item key={size}>
                          {size}
                        </List.Item>
                      ))}
                    </List>
                  </>
                )}
            </Card>
          )}
        </Flex>
        <Text size="md" ta="center">
          Please reopen the study link with a supported browser/device, input type, and display size.
          <br />
          Thank you for your understanding!
        </Text>
      </Stack>
    </Modal>
  );
}
