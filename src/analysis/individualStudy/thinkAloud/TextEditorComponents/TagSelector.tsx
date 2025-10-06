import {
  Group, ColorSwatch, useCombobox, Combobox, Pill, PillsInput, Input,
  Popover,
  ActionIcon,
  Box,
  CheckIcon,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import { useMemo } from 'react';
import { Tag } from '../types';
import { Pills } from '../tiptapExtensions/Pills';
import { TagEditor } from './TagEditor';
import { AddTagDropdown } from '../tiptapExtensions/AddTagDropdown';

export function TagSelector({
  tags, selectedTags, onSelectTags, disabled = false, taskTags, partTags, tagsEmptyText, createTagCallback, editTagCallback,
} : {tags: Tag[], selectedTags: Tag[], onSelectTags: (t: Tag[]) => void, disabled?: boolean, taskTags?: Tag[], partTags?: Tag[], tagsEmptyText: string, editTagCallback: (oldTag: Tag, newTag: Tag) => void, createTagCallback: (t: Tag) => void}) {
  const combobox = useCombobox();

  const handleValueSelect = (val: string) => onSelectTags([...selectedTags, [...tags, ...(taskTags || []), ...(partTags || [])].find((t) => t.id === val)!]);

  const handleValueRemove = (val: string) => onSelectTags(selectedTags.filter((t: Tag) => t !== undefined && t.id !== val));

  const values = <Pills selectedTags={selectedTags} removeFunc={handleValueRemove} />;

  const selectedOptions = useMemo(() => tags.filter((tag) => tag !== undefined && selectedTags.find((selT) => selT && selT.id === tag.id)).map((tag) => (
    <Combobox.Option
      value={tag.id}
      key={tag.id}
      active
    >
      <Group
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        justify="space-between"
        gap="sm"
        style={{ width: '100%' }}
      >
        <Group>
          <CheckIcon size={12} />
          <ColorSwatch size={10} color={tag.color} />
          <span>{tag.name}</span>
        </Group>
        <Box onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        >
          <Popover trapFocus withinPortal={false}>
            <Popover.Target>
              <ActionIcon
                variant="light"
                size="sm"
              >
                <IconEdit />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <AddTagDropdown
                editTag
                currentNames={tags.map((t) => t.id)}
                addTagCallback={(newTag: Tag) => {
                  editTagCallback(tag, newTag);
                }}
                editableTag={tag}
              />
            </Popover.Dropdown>
          </Popover>
        </Box>
      </Group>
    </Combobox.Option>
  )), [editTagCallback, selectedTags, tags]);

  const options = useMemo(() => tags.filter((tag) => tag !== undefined && !selectedTags.find((selT) => selT && selT.id === tag.id)).map((tag) => (
    <Combobox.Option value={tag.id} key={tag.id}>
      <Group justify="space-between" gap="sm" style={{ width: '100%' }}>
        <Group>
          <ColorSwatch size={10} color={tag.color} />

          <span>{tag.name}</span>
        </Group>
        <Box onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        >
          <Popover trapFocus withinPortal={false}>
            <Popover.Target>
              <ActionIcon
                variant="light"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <IconEdit />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <AddTagDropdown
                editTag
                currentNames={tags.map((t) => t.id)}
                addTagCallback={(newTag: Tag) => {
                  editTagCallback(tag, newTag);
                }}
                editableTag={tag}
              />
            </Popover.Dropdown>
          </Popover>
        </Box>
      </Group>
    </Combobox.Option>
  )), [editTagCallback, selectedTags, tags]);

  return (
    <Combobox disabled={disabled} width={300} store={combobox} onOptionSubmit={handleValueSelect} withinPortal>
      <Combobox.DropdownTarget>
        <PillsInput style={{ width: '250px' }} pointer onClick={() => combobox.toggleDropdown()}>
          <Pill.Group>
            {selectedTags.length > 0 ? (
              values
            ) : (
              <Input.Placeholder>{tagsEmptyText}</Input.Placeholder>
            )}

            <Combobox.EventsTarget>
              <PillsInput.Field
                type="hidden"
                // onBlur={() => combobox.closeDropdown()}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          {options.length === 0 && selectedOptions.length === 0 ? <Combobox.Empty>No additional tags</Combobox.Empty> : taskTags || partTags ? <Combobox.Group label="Text Tags">{[...selectedOptions, ...options]}</Combobox.Group> : [...selectedOptions, ...options]}
          <TagEditor createTagCallback={createTagCallback} tags={tags || []} />
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>

  );
}
