import { Sequence } from '../store/types';
import {
  ComponentBlock, DynamicBlock, Factor, FactorBlock, FactorOption, IndividualComponent, InheritedComponent, StudyConfig,
} from './types';

/** Compiler-only group that is selected atomically and flattened before rendering. */
export type FactorPlanBlock = ComponentBlock & { type: 'factor-plan' };

/** Compiler-only factor block whose ordered inputs are resolved per generated sequence. */
export type FactorRuntimePlanBlock = ComponentBlock & {
  type: 'factor-runtime-plan';
  id: string;
  factor: FactorOption;
  factors: Record<string, Factor>;
  conditionComponents: Record<string, string[]>;
};

export function isInheritedComponent(comp: IndividualComponent | InheritedComponent) : comp is InheritedComponent {
  return (<InheritedComponent>comp).baseComponent !== undefined;
}

export function isDynamicBlock(comp: StudyConfig['sequence'] | Sequence) : comp is DynamicBlock {
  return (<DynamicBlock>comp).order === 'dynamic';
}

export function isFactorBlock(comp: StudyConfig['sequence'] | Sequence) : comp is FactorBlock {
  return (<FactorBlock>comp).type === 'factor';
}

export function isFactorPlanBlock(comp: unknown): comp is FactorPlanBlock {
  return typeof comp === 'object'
    && comp !== null
    && 'type' in comp
    && comp.type === 'factor-plan';
}

export function isFactorRuntimePlanBlock(comp: unknown): comp is FactorRuntimePlanBlock {
  return typeof comp === 'object'
    && comp !== null
    && 'type' in comp
    && comp.type === 'factor-runtime-plan';
}
