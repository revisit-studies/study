import { Box, Container } from '@mantine/core';

export default function AnswerPanel(props: { data: Record<string, Record<string, unknown>>, trialName: string}) {
  const { data, trialName } = props;
  return (
    <Container p={10} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
      <Box>AnswerPanel</Box>
      {trialName}
      {data.toString()}

    </Container>
  );
}
