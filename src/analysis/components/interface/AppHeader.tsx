import {
  Flex,
  Grid,
  Header,
  Image,
  Space,
  Title,
} from '@mantine/core';
import { PREFIX } from '../../../utils/Prefix';

export default function AppHeader() {
  return (
    <Header height="70" p="md">
      <Grid mt={-7} align="center">
        <Grid.Col span={4}>
          <Flex align="center">
            <Image maw={40} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
            <Space w="md" />
            <Title order={4}>ReVISit Analytics Platform</Title>
          </Flex>
        </Grid.Col>
      </Grid>
    </Header>
  );
}
