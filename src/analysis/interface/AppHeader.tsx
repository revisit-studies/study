import {
  Box, Flex, Image, Select, Title, Space, AppShell, Button, Text, ActionIcon, Tooltip, Menu, Switch,
} from '@mantine/core';

import {
  matchPath, useLocation, useNavigate, useParams,
} from 'react-router';

import {
  IconListCheck, IconSettings, IconMoon, IconSun,
} from '@tabler/icons-react';
import { PREFIX } from '../../utils/Prefix';
import { useAppColorMode } from '../../components/AppThemeProvider';
import { useLandingPreferences } from '../../utils/landingPreferences';

const STUDY_SCHEMA_VERSION_REGEX = /\/study\/(v\d+\.\d+\.\d+)\//;

export function AppHeader({
  studyIds,
  selectedStudyId,
  studyHref,
  studyConfigs,
}: {
  studyIds: string[];
  selectedStudyId?: string;
  studyHref?: string;
  studyConfigs?: Record<string, { $schema?: unknown } | null>;
}) {
  const navigate = useNavigate();
  const { studyId } = useParams();
  const location = useLocation();
  const { colorMode, toggleColorMode } = useAppColorMode();
  const colorModeLabel = colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  const selectorData = studyIds.map((id) => ({ value: id, label: id })).sort((a, b) => a.label.localeCompare(b.label));
  const revisitVersion = studyIds
    .map((id) => {
      const schema = studyConfigs?.[id]?.$schema;
      return typeof schema === 'string' ? schema.match(STUDY_SCHEMA_VERSION_REGEX)?.[1] : undefined;
    })
    .filter((version): version is string => version !== undefined)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];

  const inAnalysis = matchPath('/analysis/*', location.pathname) !== null;
  const showThemeToggle = ['/', '/settings', '/login'].some((path) => matchPath(path, location.pathname)) || inAnalysis;
  // The tutorial/test toggles only affect the landing page, so only offer them there.
  const onLandingPage = matchPath('/', location.pathname) !== null;
  const {
    showTutorials, setShowTutorials, showTests, setShowTests,
  } = useLandingPreferences();

  return (
    <AppShell.Header p="md">
      <Flex align="center" gap="md" h="100%">
        <Box style={{ flexShrink: 0 }}>
          <Flex align="center" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <Image w={40} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
            <Space w="md" />
            <Title order={4} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inAnalysis ? 'ReVISit Analytics Platform' : 'ReVISit Studies'}
            </Title>
          </Flex>
        </Box>

        <Box style={{ flex: 1, minWidth: 0 }} />

        <Box style={{ flexShrink: 0 }}>
          <Flex
            align="center"
            justify="flex-end"
            direction="row"
          >
            {inAnalysis && (
              <>
                <Select
                  allowDeselect={false}
                  placeholder="Select Study"
                  data={selectorData}
                  value={selectedStudyId ?? studyId}
                  onChange={(value) => navigate(`/analysis/stats/${value}`)}
                  mr={16}
                />
                <Button component="a" href={studyHref ?? `${PREFIX}${studyId}`} target="_blank" leftSection={<IconListCheck />} mr="sm">
                  Go to Study
                </Button>
              </>
            )}

            {showThemeToggle && (
              <Tooltip label={colorModeLabel}>
                <ActionIcon aria-label={colorModeLabel} variant="default" size="lg" mr="sm" onClick={toggleColorMode}>
                  {colorMode === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                </ActionIcon>
              </Tooltip>
            )}
            {revisitVersion && <Text c="dimmed" size="sm" mr="sm">{`reVISit ${revisitVersion}`}</Text>}
            <Menu position="bottom-end" shadow="md" withinPortal closeOnItemClick={false}>
              <Menu.Target>
                <ActionIcon aria-label="Settings menu" variant="subtle" color="gray" size="lg">
                  <IconSettings />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {onLandingPage && (
                  <>
                    <Menu.Label>Landing page</Menu.Label>
                    <Menu.Item onClick={() => setShowTutorials((value) => !value)}>
                      <Switch label="Show tutorials" checked={showTutorials} readOnly size="xs" style={{ pointerEvents: 'none' }} />
                    </Menu.Item>
                    <Menu.Item onClick={() => setShowTests((value) => !value)}>
                      <Switch label="Show tests" checked={showTests} readOnly size="xs" style={{ pointerEvents: 'none' }} />
                    </Menu.Item>
                    <Menu.Divider />
                  </>
                )}
                <Menu.Item leftSection={<IconSettings size={14} />} onClick={() => navigate('/settings')}>
                  Settings
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Flex>
        </Box>
      </Flex>
    </AppShell.Header>
  );
}
