import { useState } from 'react';
import {
  Center,
  Flex,
  Radio,
  RadioGroup,
  Text,
} from '@mantine/core';

export function RadioOptions() {
  const [value, setValue] = useState('');
  return (
    <Center style={{ flexDirection: 'column' }}>
      <Text style={{
        textAlign: 'center', paddingBottom: '24px', fontSize: '18px', fontWeight: 'bold',
      }}
      >
        Select the option with the higher correlation
      </Text>
      <RadioGroup value={value} onChange={setValue}>
        <Flex
          gap="md"
          justify="justify-content"
          direction="row"
        >
          <Radio value="Option 1" label="Option 1" />
          <Radio value="Option 2" label="Option 2" />
        </Flex>
      </RadioGroup>
    </Center>
  );
}
