import { Sequence } from '../store/types';
import {
  DynamicBlock, Factor, FactorDefinition, FactorSequence, FactorSequenceReference, IndividualComponent, InheritedComponent, StudyConfig,
} from './types';

export function isInheritedComponent(comp: IndividualComponent | InheritedComponent) : comp is InheritedComponent {
  return (<InheritedComponent>comp).baseComponent !== undefined;
}

export function isDynamicBlock(comp: StudyConfig['sequence'] | Sequence) : comp is DynamicBlock {
  return (<DynamicBlock>comp).order === 'dynamic';
}

export function isFactorDefinition(factor: Factor | undefined): factor is FactorDefinition {
  return Boolean(factor) && typeof factor === 'object' && !Array.isArray(factor) && 'values' in factor;
}

export function isFactorSequence(comp: StudyConfig['sequence'] | Sequence) : comp is FactorSequence {
  return (<FactorSequence>comp).values !== undefined;
}

export function isFactorSequenceReference(comp: StudyConfig['sequence'] | Sequence) : comp is FactorSequenceReference {
  return (<FactorSequenceReference>comp).type === 'factor' && (<FactorSequence>comp).values === undefined;
}
