import {
  Flex, Image, Select, Title, Space, Grid, Drawer, Text, Burger, Button, Divider,
  Box, AppShell,
} from '@mantine/core';

import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { IconSettings, IconFileLambda, IconChartBar } from '@tabler/icons-react';

import React, { useState } from 'react';
import { PREFIX } from '../../utils/Prefix';
import { useAuth } from '../../store/hooks/useAuth';
import { useStorageEngine } from '../../storage/storageEngineHooks';

export default function AppHeader({ studyIds }: { studyIds: string[] }) {
  const navigate = useNavigate();
  const { studyId } = useParams();
  const location = useLocation();

  const selectorData = studyIds.map((id) => ({ value: id, label: id }));
  const { storageEngine } = useStorageEngine();
  const { user, logout } = useAuth();
  const [navOpen, setNavOpen] = useState<boolean>(false);

  const inAnalysis = location.pathname.includes('analysis');

  interface MenuItem {
    'name': string,
    'leftIcon': JSX.Element|null,
    'href': string,
    'needAdmin': boolean
  }
  const menuItemsNav: MenuItem[] = [
    {
      name: 'Studies',
      leftIcon: <IconFileLambda />,
      href: '/',
      needAdmin: false,
    },
    {
      name: 'Analysis',
      leftIcon: <IconChartBar />,
      href: '/analysis/dashboard',
      needAdmin: false,
    },
    {
      name: 'Settings',
      leftIcon: <IconSettings />,
      href: '/settings',
      needAdmin: true,
    },
  ];

  return (
    <AppShell.Header p="md">
      <Grid mt={-7} align="center">
        <Grid.Col span={6}>
          <Flex align="center" onClick={() => (inAnalysis ? navigate('/analysis/dashboard') : navigate('/'))} style={{ cursor: 'pointer' }}>
            <Image w={40} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
            <Space w="md" />
            <Title order={4} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inAnalysis ? 'ReVISit Analytics Platform' : 'ReVISit Studies'}
            </Title>
          </Flex>
        </Grid.Col>

        <Grid.Col span={6}>
          <Flex
            justify="flex-end"
            direction="row"
          >
            {inAnalysis && (
            <Select
              allowDeselect={false}
              placeholder="Select Study"
              data={selectorData}
              value={studyId}
              onChange={(value) => navigate(`/analysis/stats/${value}`)}
              mr={16}
            />
            )}

            <Burger opened={false} onClick={() => setNavOpen(true)} style={{ visibility: navOpen ? 'hidden' : undefined }} />
            <Drawer
              opened={navOpen}
              onClose={() => setNavOpen(false)}
              position="right"
              withCloseButton={false}
            >
              <Flex direction="column" mt={20}>
                <Text ml={15} mb={20} fw={700} size="lg">Navigation</Text>
                {menuItemsNav.map((menuItem: MenuItem) => {
                  if (menuItem.needAdmin) {
                    if (user.isAdmin) {
                      return (
                        <Button
                          key={`menu-item-${menuItem.name}`}
                          leftSection={menuItem.leftIcon}
                          variant="default"
                          style={{ border: 'none', display: 'flex', justifyContent: 'flex-start' }}
                          onClick={() => { navigate(menuItem.href); setNavOpen(false); }}
                        >
                          {menuItem.name}
                        </Button>
                      );
                    } return null;
                  }
                  return (
                    <Button
                      key={`menu-item-${menuItem.name}`}
                      leftSection={menuItem.leftIcon}
                      variant="default"
                      style={{ border: 'none', display: 'flex', justifyContent: 'flex-start' }}
                      onClick={() => { navigate(menuItem.href); setNavOpen(false); }}
                    >
                      {menuItem.name}
                    </Button>
                  );
                })}
                <Box ml={10}>
                  <Divider my="sm" />
                  {/* eslint-disable-next-line no-nested-ternary */}
                  { storageEngine?.getEngine() === 'firebase'
                    ? user.isAdmin
                      ? (
                        <Text
                          size="sm"
                          ml={10}
                          style={{ cursor: 'pointer' }}
                          onClick={() => { logout(); navigate('/login'); setNavOpen(false); }}
                        >
                          Logout
                        </Text>
                      )
                      : (
                        <Text
                          size="sm"
                          ml={10}
                          style={{ cursor: 'pointer' }}
                          onClick={() => { navigate('/login'); setNavOpen(false); }}
                        >
                          Login
                        </Text>
                      ) : null}
                </Box>
              </Flex>
            </Drawer>
          </Flex>
        </Grid.Col>
      </Grid>
    </AppShell.Header>
  );
}
