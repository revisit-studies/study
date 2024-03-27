import {
  Flex,
  Header, Image, Title,
} from '@mantine/core';

// eslint-disable-next-line  import/no-unresolved
import logo from '../../assets/revisitLogoSquare.svg';

export default function AppHeader() {
  return (
    <Header height="70" p="md">
      <Flex
        mih={50}
        gap="md"
        justify="flex-start"
        align="center"
        direction="row"
        wrap="wrap"
      >
        <Image maw={50} src={logo} />

        <Title order={1}>reVISit Analytics Platform</Title>

      </Flex>
    </Header>
  );
}
