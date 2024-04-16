import { Box, Container } from '@mantine/core';
import { IndividualComponent, InheritedComponent } from '../../../parser/types';

export default function AnswerPanel(props: { data: Record<string, Record<string, unknown>>, trialName: string, config: IndividualComponent | InheritedComponent | undefined}) {
  const { data, trialName, config } = props;
  return (
    <Container p={10} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
      <Box>AnswerPanel</Box>
      {trialName}
      {data.toString()}
      {config?.toString()}

    </Container>
  );
}
