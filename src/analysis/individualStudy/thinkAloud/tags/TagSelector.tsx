import {
  Group, ColorSwatch, useCombobox, Combobox, Pill, PillsInput, Input,
  Popover,
  ActionIcon,
  Box,
  CheckIcon,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';
import { Tag } from '../types';
import { Pills } from './Pills';
import { TagEditor } from './TagEditor';
import { AddTagDropdown } from './AddTagDropdown';

export function TagSelector({
  tags, selectedTags, onSelectTags, disabled = false, tagsEmptyText, createTagCallback, editTagCallback, width,
}: {
  tags: Tag[], selectedTags: Tag[], onSelectTags: (t: Tag[]) => void, disabled?: boolean, tagsEmptyText: string, editTagCallback: (oldTag: Tag, newTag: Tag) => void, createTagCallback: (t: Tag) => void, width: number
}) {
  const combobox = useCombobox();

  const handleValueRemove = useCallback((val: string) => onSelectTags(selectedTags.filter((t: Tag) => t !== undefined && t.id !== val)), [onSelectTags, selectedTags]);

  const handleValueSelect = useCallback(
    (val: string) => {
      if (selectedTags.find((t) => t.id === val)) {
        handleValueRemove(val);
        return;
      }
      onSelectTags([...selectedTags, [...tags].find((t) => t.id === val)!]);
    },
    [handleValueRemove, onSelectTags, selectedTags, tags],
  );

  const values = <Pills selectedTags={selectedTags} removeFunc={handleValueRemove} />;

  const selectedOptions = useMemo(() => tags.filter((tag) => tag !== undefined && selectedTags.find((selT) => selT && selT.id === tag.id)).map((tag) => (
    <Combobox.Option
      value={tag.id}
      key={tag.id}
      active
    >
      <Group
        justify="space-between"
        gap="sm"
        style={{ width: '100%' }}
        wrap="nowrap"
      >
        <Tooltip label={tag.name} withArrow openDelay={600}>
          <Group wrap="nowrap">
            <CheckIcon size={12} />
            <ColorSwatch size={10} color={tag.color} />
            <Text style={{ width: width - 120 }} truncate="end">{tag.name}</Text>
          </Group>
        </Tooltip>
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
  )), [editTagCallback, selectedTags, tags, width]);

  const options = useMemo(() => tags.filter((tag) => tag !== undefined && !selectedTags.find((selT) => selT && selT.id === tag.id)).map((tag) => (
    <Combobox.Option value={tag.id} key={tag.id}>
      <Group justify="space-between" gap="sm" style={{ width: '100%' }} wrap="nowrap">
        <Tooltip label={tag.name} withArrow openDelay={600}>

          <Group wrap="nowrap">
            <ColorSwatch size={10} color={tag.color} />

            <Text style={{ width: width - 100 }} truncate="end">{tag.name}</Text>
          </Group>
        </Tooltip>
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
  )), [editTagCallback, selectedTags, tags, width]);

  return (
    <Combobox disabled={disabled} width={width} store={combobox} onOptionSubmit={handleValueSelect} withinPortal>
      <Combobox.DropdownTarget>
        <PillsInput style={{ width }} pointer onClick={() => combobox.toggleDropdown()}>
          <Pill.Group>
            {selectedTags.length > 0 ? (
              values
            ) : (
              <Input.Placeholder>{tagsEmptyText}</Input.Placeholder>
            )}

            <Combobox.EventsTarget>
              <PillsInput.Field
                type="hidden"
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          {options.length === 0 && selectedOptions.length === 0 ? <Combobox.Empty>No additional tags</Combobox.Empty> : [...selectedOptions, ...options]}
          <TagEditor createTagCallback={createTagCallback} tags={tags || []} />
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>

  );
}
