import {
  Affix, Badge, Box, Navbar, NavLink, Text,
} from '@mantine/core';
import {
  IconHome2, IconZoomQuestion, IconLayoutDashboard, IconChevronRight, IconBrowserPlus,
} from '@tabler/icons-react';
// import { useNavigate } from 'react-router-dom';
// import { StateContext } from '../../StateProvider';

export default function AppNav() {
  // const { activeTab, setActiveTab } = useContext(StateContext);
  // const navigate = useNavigate();

  const onClickLink = (tab:string) => {
    // console.log(tab);
    // setActiveTab(tab);
    // navigate(tab);
  };

  return (
    <Navbar width={{ base: 230 }} style={{ zIndex: 0 }}>

      <Navbar.Section p="xl">
        <Box w={200}>
          <NavLink
                          // active={activeTab === 'home'}
            onClick={() => onClickLink('home')}
            label={<Text fz="lg"> Home </Text>}
            icon={<IconHome2 size="2rem" stroke={1.5} color="#4287f5" />}
            rightSection={<IconChevronRight size="0.8rem" stroke={1.5} />}
          />

          <NavLink
                            // active={activeTab === 'dashboard'}
            onClick={() => onClickLink('dashboard')}
            label={<Text fz="lg"> Dashboard </Text>}
            icon={<IconLayoutDashboard size="2rem" stroke={1.5} color="#4287f5" />}
            rightSection={<IconChevronRight size="0.8rem" stroke={1.5} />}
          />
          <NavLink
                            // active={activeTab === 'browser'}
            onClick={() => onClickLink('browser')}
            label={<Text fz="lg"> Browser </Text>}
            icon={<IconBrowserPlus size="2rem" stroke={1.5} color="#4287f5" />}
            rightSection={<IconChevronRight size="0.8rem" stroke={1.5} />}
          />

          <NavLink
                          // active={activeTab === 'about'}
            onClick={() => onClickLink('about')}
            label={<Text fz="lg"> About </Text>}
            icon={<IconZoomQuestion size="2rem" stroke={1.5} color="#4287f5" />}
            rightSection={<IconChevronRight size="0.8rem" stroke={1.5} />}
          />
        </Box>
      </Navbar.Section>
      <Navbar.Section p="xl">
        <Affix position={{ bottom: 10, left: 10 }}>
          <Box w={240}>
            <Badge color="green">Connected</Badge>
            {' '}
            :
            <Badge color="red">Disconnected</Badge>
          </Box>

        </Affix>
      </Navbar.Section>

    </Navbar>
  );
}
