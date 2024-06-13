import {
  AppShell,
  NavLink, Text,
} from '@mantine/core';
import {
  IconZoomQuestion, IconLayoutDashboard, IconChevronRight, IconBrowserPlus,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function AppNav() {
  const navigate = useNavigate();
  const { page } = useParams();

  return (
    <AppShell.Navbar>
      <AppShell.Section p="xl">
        <NavLink
          active={page === 'dashboard'}
          onClick={() => navigate('/analysis/dashboard')}
          label={<Text fz="lg">Dashboard</Text>}
          leftSection={<IconLayoutDashboard color="#4287f5" />}
          rightSection={<IconChevronRight size="0.8rem" stroke={1.5} />}
        />
        <NavLink
          active={page === 'browser'}
          onClick={() => navigate('/analysis/browser')}
          label={<Text fz="lg">Browser</Text>}
          leftSection={<IconBrowserPlus color="#4287f5" />}
          rightSection={<IconChevronRight size="0.8rem" stroke={1.5} />}
        />
        <NavLink
          active={page === 'about'}
          onClick={() => navigate('/analysis/about')}
          label={<Text fz="lg">About</Text>}
          leftSection={<IconZoomQuestion color="#4287f5" />}
          rightSection={<IconChevronRight size="0.8rem" stroke={1.5} />}
        />
      </AppShell.Section>
    </AppShell.Navbar>
  );
}
