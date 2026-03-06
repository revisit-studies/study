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
import { useDeviceRules } from '../../utils/useDeviceRules';

export function DeviceWarning({
  developmentModeEnabled,
}: {
  developmentModeEnabled?: boolean
}) {
  const studyConfig = useStudyConfig();
  const { storageEngine } = useStorageEngine();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRejected, setIsRejected] = useState(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storageEngineRef = useRef(storageEngine);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    storageEngineRef.current = storageEngine;
  }, [storageEngine]);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

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
  const hasAnyViolation = !isBrowserAllowed || !isDeviceAllowed || !isInputAllowed || !isDisplayAllowed;
  const violatedSettings = [
    !isBrowserAllowed ? 'Browser' : null,
    !isDeviceAllowed ? 'Device' : null,
    !isInputAllowed ? 'Input' : null,
    !isDisplayAllowed ? 'Display' : null,
  ].filter((setting): setting is string => setting !== null);
  const warningTitle = violatedSettings.length > 0
    ? `${violatedSettings.join(', ')} Requirement${violatedSettings.length > 1 ? 's' : ''} Not Met`
    : 'Device Requirement Not Met';
  const isDisplayRequirementNotMet = !isDisplayAllowed && (
    (display?.minWidth !== undefined && currentDisplay.width < display.minWidth)
    || (display?.minHeight !== undefined && currentDisplay.height < display.minHeight)
  );
  const shouldRunDisplayCountdown = !developmentModeEnabled && !isRejected && isDisplayRequirementNotMet;

  useEffect(() => {
    if (shouldRunDisplayCountdown) {
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

            if (storageEngineRef.current) {
              setIsRejected(true);
              storageEngineRef.current.rejectCurrentParticipant('Screen resolution requirements not met')
                .catch(() => {
                  console.error('Failed to reject participant who failed display requirements');
                })
                .finally(() => {
                  navigateRef.current(`./../__trainingFailed${window.location.search}`);
                });
            } else {
              setIsRejected(true);
              navigateRef.current(`./../__trainingFailed${window.location.search}`);
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
  }, [shouldRunDisplayCountdown]);

  if (developmentModeEnabled || (!isRejected && !hasAnyViolation)) {
    return null;
  }

  return (
    <Modal opened onClose={() => {}} fullScreen withCloseButton={false}>
      <Stack align="center" justify="center">
        <IconAlertTriangle size={64} color="orange" />
        <Title order={3}>{warningTitle}</Title>
        {isRejected && (
          <Text size="md" ta="center" c="red">
            You have been rejected because your display size stayed outside
            the minimum requirements for 60 seconds.
          </Text>
        )}
        {shouldRunDisplayCountdown && (
          <Text size="md" ta="center" c="red">
            Please resize your browser window to the allowed range within
            {' '}
            {timeLeft}
            {' '}
            seconds or you will not be able to continue the study.
          </Text>
        )}
        <Flex wrap="wrap" justify="center">
          {!isBrowserAllowed && (
          <Card shadow="sm" padding="lg" radius="md" mx="md" my="md" withBorder w={400}>
            <Card.Section bg="gray.3" mb="md" p="md" style={{ display: 'flex', justifyContent: 'center' }}>
              <IconBrowser size={48} color="gray" />
            </Card.Section>
            {browsers?.blockedMessage
              ? (
                <Text size="md" c="red" mb="xs">
                  {browsers.blockedMessage}
                  Current browser:
                  {' '}
                  {currentBrowser.name}
                  {currentBrowser.version ? ` v${currentBrowser.version}` : ''}
                </Text>
              ) : (
                <>
                  <Text size="md" c="red" mb="xs">
                    Your browser is not compatible with the study.
                    Current browser:
                    {' '}
                    {currentBrowser.name}
                    {currentBrowser.version ? ` v${currentBrowser.version}` : ''}
                  </Text>
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
            {devices?.blockedMessage
              ? (
                <Text size="md" c="red" mb="xs">
                  {devices.blockedMessage}
                  Current device:
                  {' '}
                  {currentDevice}
                </Text>
              ) : (
                <>
                  <Text size="md" c="red" mb="xs">
                    Your device is not compatible with the study.
                    Current device:
                    {' '}
                    {currentDevice}
                  </Text>
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
            {inputs?.blockedMessage
              ? (
                <Text size="md" c="red" mb="xs">
                  {inputs.blockedMessage}
                  Current input:
                  {' '}
                  {currentInputs.length ? currentInputs.join(', ') : 'none detected'}
                </Text>
              ) : (
                <>
                  <Text size="md" c="red" mb="xs">
                    Your input type is not compatible with the study.
                    Current input:
                    {' '}
                    {currentInputs.length ? currentInputs.join(', ') : 'none detected'}
                  </Text>
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
              {display?.blockedMessage
                ? (
                  <Text size="md" c="red" mb="xs">
                    {display.blockedMessage}
                    Current display:
                    {' '}
                    {`${currentDisplay.width} x ${currentDisplay.height}px`}
                  </Text>
                ) : (
                  <>
                    <Text size="md" c="red" mb="xs">
                      Your screen size is not compatible with the study.
                      Current display:
                      {' '}
                      {`${currentDisplay.width} x ${currentDisplay.height}px`}
                    </Text>
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
          Please reopen the study link with a supported device.
          <br />
          Thank you for your understanding!
        </Text>
      </Stack>
    </Modal>
  );
}
