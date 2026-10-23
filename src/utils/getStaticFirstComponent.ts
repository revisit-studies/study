import type {
  ComponentBlock,
  ImageComponent,
  MarkdownComponent,
  StudyConfig,
} from '../parser/types';
import { isFactorPlanBlock, isFactorRuntimePlanBlock } from '../parser/utils';
import { getComponent } from './handleComponentInheritance';
import { getStaticAssetByPath } from './getStaticAsset';
import { PREFIX } from './Prefix';

export type StaticFirstComponent = MarkdownComponent | ImageComponent;
export type StaticFirstComponentPreview = {
  componentName: string;
  component: StaticFirstComponent;
  /** The fetched body of a Markdown component, already checked to be static. */
  markdown?: string;
};

function hasTemplateSyntax(value: string) {
  return value.includes('{{') || value.includes('}}');
}

function isFixedBlock(value: unknown): value is ComponentBlock {
  if (typeof value !== 'object' || value === null
    || isFactorPlanBlock(value) || isFactorRuntimePlanBlock(value)) {
    return false;
  }

  const block = value as Partial<ComponentBlock> & { type?: string };
  return block.type !== 'factor'
    && block.order === 'fixed'
    && Array.isArray(block.components)
    && block.numSamples === undefined
    && block.conditional !== true
    && (block.interruptions === undefined || block.interruptions.length === 0)
    && (block.skip === undefined || block.skip.length === 0);
}

function getFirstComponentName(block: unknown): string | null {
  if (!isFixedBlock(block)) {
    return null;
  }

  const [firstComponent] = block.components;
  if (typeof firstComponent === 'string') {
    return firstComponent;
  }

  return firstComponent === undefined ? null : getFirstComponentName(firstComponent);
}

/**
 * Returns a component that can be displayed while a new participant's sequence
 * is assigned. The preview renderer displays only this static stimulus; it does
 * not mount the component's responses or the participant runtime.
 */
export function getStaticFirstComponent(studyConfig: StudyConfig): StaticFirstComponentPreview | null {
  // Assignment can materialize a different config for each between-subjects
  // condition. Until that assignment exists, even an otherwise fixed first
  // component is not guaranteed to be the component the participant receives.
  if ((studyConfig.betweenSubjects?.length ?? 0) > 0) {
    return null;
  }

  const componentName = getFirstComponentName(studyConfig.sequence);
  if (componentName === null) {
    return null;
  }

  const component = getComponent(componentName, studyConfig);
  if ((component?.type !== 'markdown' && component?.type !== 'image')
    || hasTemplateSyntax(component.path)) {
    return null;
  }

  // The participant runtime starts these timers only after initialization.
  const enableTime = component.nextButtonEnableTime ?? studyConfig.uiConfig.nextButtonEnableTime;
  const disableTime = component.nextButtonDisableTime ?? studyConfig.uiConfig.nextButtonDisableTime;
  if (enableTime || disableTime || component.nextButtonAutoAdvanceTime !== undefined) {
    return null;
  }

  return { componentName, component };
}

export function getStaticAssetUrl(path: string) {
  return path.startsWith('http') ? path : `${PREFIX}${path}`;
}

/**
 * Resolves the startup preview, including the body of a Markdown component. The
 * participant page compiles that body with the full template context, which is
 * unavailable until the participant is initialized, so a body with template
 * syntax (placeholders or conditional branches) is not previewed. A body that
 * cannot be loaded is not previewed either, leaving the regular loading state.
 */
export async function loadStaticFirstComponentPreview(
  studyConfig: StudyConfig,
): Promise<StaticFirstComponentPreview | null> {
  const preview = getStaticFirstComponent(studyConfig);
  if (preview?.component.type !== 'markdown') {
    return preview;
  }

  const markdown = await getStaticAssetByPath(getStaticAssetUrl(preview.component.path));
  if (markdown === undefined || hasTemplateSyntax(markdown)) {
    return null;
  }

  return { ...preview, markdown };
}
