import { useMantineColorScheme } from '@mantine/core';

export function useIsDarkMode() {
  const { colorScheme } = useMantineColorScheme();

  return colorScheme === 'dark';
}
