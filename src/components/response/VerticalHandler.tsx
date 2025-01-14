import { Stack, Group, rem } from '@mantine/core';

export function VerticalHandler({ vertical, children, style }: { vertical: boolean; children: React.ReactNode, style: React.CSSProperties }) {
  if (vertical) {
    return (
      <Stack gap="md" style={style}>
        {children}
      </Stack>
    );
  }
  return (
    <Group mt={rem(4)} gap="lg" style={style}>
      {children}
    </Group>
  );
}
