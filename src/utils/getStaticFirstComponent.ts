import type {
  ComponentBlock,
  ImageComponent,
  MarkdownComponent,
  StudyConfig,
} from '../parser/types';
import { isFactorPlanBlock, isFactorRuntimePlanBlock } from '../parser/utils';
import { getComponent } from './handleComponentInheritance';

export type StaticFirstComponent = MarkdownComponent | ImageComponent;
export type StaticFirstComponentPreview = {
  componentName: string;
  component: StaticFirstComponent;
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
 * is assigned. This deliberately accepts only fixed Markdown or image
 * components. Any responses are rendered disabled until the assigned session
 * replaces the preview, so no participant input can be lost.
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

  return { componentName, component };
}
