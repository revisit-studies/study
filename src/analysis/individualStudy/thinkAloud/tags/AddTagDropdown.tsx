import {
  Button,
  ColorPicker,
  ColorSwatch,
  Group, Stack, TextInput,
} from '@mantine/core';
import React, { useCallback, useState } from 'react';
import { v4 as uuidFunc } from 'uuid';
import { Tag } from '../types';

const normalizeTagName = (tagName: string) => tagName.trim().toLowerCase();

export function AddTagDropdown({
  addTagCallback, currentNames, editTag = false, editableTag,
} : {addTagCallback : (tag: Tag) => void | Promise<void>, currentNames: string[], editTag?: boolean, editableTag?: Tag}) {
  const [name, setName] = useState<string>(editTag ? editableTag!.name : '');
  const [color, setColor] = useState<string>(editTag ? editableTag!.color : '#fd7e14');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const normalizedName = normalizeTagName(name);
  const normalizedEditableName = editableTag ? normalizeTagName(editableTag.name) : null;
  const duplicateName = normalizedName.length > 0 && currentNames.some((currentName) => {
    const normalizedCurrentName = normalizeTagName(currentName);
    return normalizedCurrentName === normalizedName
      && (!editTag || normalizedCurrentName !== normalizedEditableName);
  });
  const unchangedTag = editTag && editableTag
    ? trimmedName === editableTag.name && color === editableTag.color
    : false;
  const validationError = duplicateName ? 'Tag with this name already exists' : null;
  const submitDisabled = trimmedName.length === 0 || duplicateName || unchangedTag || isSubmitting;

  const createTag = useCallback(async () => {
    if (submitDisabled) {
      return;
    }

    const uuid = uuidFunc();

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await addTagCallback({ color, name: trimmedName, id: editTag && editableTag ? editableTag.id : uuid });
    } catch {
      setSubmitError('Unable to save tag. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [addTagCallback, color, editTag, editableTag, submitDisabled, trimmedName]);

  return (
    <Stack gap="xs">
      <Group>
        <ColorSwatch color={color} />
        <TextInput
          required
          placeholder="Enter tag name"
          value={name}
          onChange={(e) => {
            setName(e.currentTarget.value);
            setSubmitError(null);
          }}
          error={validationError || submitError}
        />
      </Group>
      <ColorPicker
        withPicker={editTag}
        style={{ width: '100%' }}
        value={color}
        onChange={(e) => {
          setColor(e);
          setSubmitError(null);
        }}
        swatches={['#2e2e2e', '#868e96', '#fa5252', '#e64980', '#be4bdb', '#7950f2', '#4c6ef5', '#228be6', '#15aabf', '#12b886', '#40c057', '#82c91e', '#fab005', '#fd7e14']}
      />
      <Button disabled={submitDisabled} loading={isSubmitting} size="compact-sm" onClick={createTag}>{editTag ? 'Edit Tag' : 'Add Tag'}</Button>
    </Stack>
  );
}
