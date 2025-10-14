import {
  Button,
  ColorPicker,
  ColorSwatch,
  Group, Stack, TextInput,
} from '@mantine/core';
import React, { useCallback, useState } from 'react';
import { v4 as uuidFunc } from 'uuid';
import { Tag } from '../types';

export function AddTagDropdown({
  addTagCallback, currentNames, editTag = false, editableTag,
} : {addTagCallback : (tag: Tag) => void, currentNames: string[], editTag?: boolean, editableTag?: Tag}) {
  const [name, setName] = useState<string>(editTag ? editableTag!.name : '');
  const [color, setColor] = useState<string>(editTag ? editableTag!.color : '#fd7e14');

  const createTag = useCallback(() => {
    const uuid = uuidFunc();

    addTagCallback({ color, name, id: editTag && editableTag ? editableTag.id : uuid });
  }, [addTagCallback, color, editTag, editableTag, name]);

  return (
    <Stack gap="xs">
      <Group>
        <ColorSwatch color={color} />
        <TextInput required placeholder="Enter tag name" value={name} onChange={(e) => setName(e.currentTarget.value)} error={currentNames.includes(name) && (!editTag || editableTag!.name !== name) ? 'Tag with this name already exists' : null} />
      </Group>
      <ColorPicker
        withPicker={editTag}
        style={{ width: '100%' }}
        value={color}
        onChange={(e) => setColor(e)}
        swatches={['#2e2e2e', '#868e96', '#fa5252', '#e64980', '#be4bdb', '#7950f2', '#4c6ef5', '#228be6', '#15aabf', '#12b886', '#40c057', '#82c91e', '#fab005', '#fd7e14']}
      />
      <Button disabled={(editTag && color === editableTag!.color) && (name.length === 0 || currentNames.includes(name))} size="compact-sm" onClick={() => createTag()}>{editTag ? 'Edit Tag' : 'Add Tag'}</Button>
    </Stack>
  );
}
