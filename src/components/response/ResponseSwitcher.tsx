import { Box, Checkbox, Divider } from '@mantine/core';
import { useSearchParams } from 'react-router';
import { useMemo } from 'react';
import { GetInputPropsReturnType } from '@mantine/form/lib/types';
import {
  IndividualComponent, MatrixResponse, Response, SliderResponse, StoredAnswer,
} from '../../parser/types';
import { CheckBoxInput } from './CheckBoxInput';
import { DropdownInput } from './DropdownInput';
import { Reactive } from './ReactiveInput';
import { LikertInput } from './LikertInput';
import { NumericInput } from './NumericInput';
import { RadioInput } from './RadioInput';
import { SliderInput } from './SliderInput';
import { StringInput } from './StringInput';
import { TextAreaInput } from './TextAreaInput';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { MatrixInput } from './MatrixInput';
import { ButtonsInput } from './ButtonsInput';
import classes from './css/Checkbox.module.css';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { useStoreSelector } from '../../store/store';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { useCurrentStep } from '../../routes/utils';
import { TextOnlyInput } from './TextOnlyInput';
import { useFetchStylesheet } from '../../utils/fetchStylesheet';

export function ResponseSwitcher({
  response,
  form,
  storedAnswer,
  index,
  configInUse,
  dontKnowCheckbox,
  otherInput,
  disabled,
}: {
  response: Response;
  form: GetInputPropsReturnType;
  storedAnswer?: StoredAnswer['answer'];
  index: number;
  configInUse: IndividualComponent;
  dontKnowCheckbox?: GetInputPropsReturnType;
  otherInput?: GetInputPropsReturnType;
  disabled?: boolean;
}) {
  const isAnalysis = useIsAnalysis();
  // Don't update if we're in analysis mode
  const ans = (isAnalysis ? { value: storedAnswer![response.id] } : form) || { value: undefined };
  const dontKnowValue = (Object.keys(storedAnswer || {}).length > 0 ? { checked: storedAnswer![`${response.id}-dontKnow`] } : dontKnowCheckbox) || { checked: undefined };
  const otherValue = (Object.keys(storedAnswer || {}).length > 0 ? { value: storedAnswer![`${response.id}-other`] } : otherInput) || { value: undefined };
  const inputDisabled = Object.keys(storedAnswer || {}).length > 0 || disabled;

  const [searchParams] = useSearchParams();

  const studyConfig = useStudyConfig();

  const enumerateQuestions = useMemo(() => configInUse?.enumerateQuestions ?? studyConfig.uiConfig.enumerateQuestions ?? false, [configInUse, studyConfig]);

  const sequence = useStoreSelector((state) => state.sequence);
  const flatSequence = getSequenceFlatMap(sequence);
  const currentStep = useCurrentStep();

  useFetchStylesheet(response.stylesheetPath);

  const isDisabled = useMemo(() => {
    // Do not disable if we're at the last element before a dynamic block
    if (typeof currentStep === 'number') {
      const currentComponent = flatSequence[currentStep];
      for (let i = 0; i < sequence.components.length; i += 1) {
        const component = sequence.components[i];
        if (typeof component === 'string') {
          if (component === currentComponent) {
            // Check if the next component is a dynamic block
            if (i + 1 < sequence.components.length && typeof sequence.components[i + 1] !== 'string') {
              return false;
            }
            break;
          }
        }
      }
    }

    // Do not disable if the next page has previousButton enabled
    if (typeof currentStep === 'number' && currentStep + 1 < flatSequence.length) {
      const nextComponent = flatSequence[currentStep + 1];
      const nextConfig = studyConfig.components[nextComponent];
      if (nextConfig?.previousButton) {
        return false;
      }
    }

    if (response.paramCapture) {
      const responseParam = searchParams.get(response.paramCapture);
      return inputDisabled || !!responseParam;
    }
    return disabled;
  }, [disabled, response.paramCapture, searchParams, currentStep, flatSequence, studyConfig.components, sequence, inputDisabled]);

  const fieldInitialValue = useMemo(() => {
    if (response.paramCapture) {
      return searchParams.get(response.paramCapture) || '';
    }

    if (response.type === 'reactive' || response.type === 'checkbox') {
      return [];
    }

    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      return Object.fromEntries(response.questionOptions.map((entry) => [entry, '']));
    }

    if (response.type === 'slider' && response.startingValue) {
      return response.startingValue.toString();
    }

    return '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response.paramCapture, (response as MatrixResponse).questionOptions, (response as SliderResponse).startingValue, response.type, searchParams]);

  const responseStyle = response.style || {};
  const responseDividers = useMemo(() => response.withDivider ?? configInUse?.responseDividers ?? studyConfig.uiConfig.responseDividers, [response, configInUse, studyConfig]);

  return (
    <Box mb={responseDividers ? 'xl' : 'lg'} className="response" id={response.id} style={responseStyle}>
      {response.type === 'numerical' && (
      <NumericInput
        response={response}
        disabled={isDisabled || dontKnowCheckbox?.checked}
        answer={ans as { value: number }}
        index={index}
        enumerateQuestions={enumerateQuestions}
      />
      )}
      {response.type === 'shortText' && (
      <StringInput
        response={response}
        disabled={isDisabled || dontKnowCheckbox?.checked}
        answer={ans as { value: string }}
        index={index}
        enumerateQuestions={enumerateQuestions}
      />
      )}
      {response.type === 'longText' && (
      <TextAreaInput
        response={response}
        disabled={isDisabled || dontKnowCheckbox?.checked}
        answer={ans as { value: string }}
        index={index}
        enumerateQuestions={enumerateQuestions}
      />
      )}
      {response.type === 'likert' && (
      <LikertInput
        response={response}
        disabled={isDisabled || dontKnowCheckbox?.checked}
        answer={ans as { value: string }}
        index={index}
        enumerateQuestions={enumerateQuestions}
      />
      )}
      {response.type === 'dropdown' && (
      <DropdownInput
        response={response}
        disabled={isDisabled || dontKnowCheckbox?.checked}
        answer={ans as { value: string }}
        index={index}
        enumerateQuestions={enumerateQuestions}
      />
      )}
      {response.type === 'slider' && (
      <SliderInput
        response={response}
        disabled={isDisabled || dontKnowCheckbox?.checked}
        answer={ans as { value: number }}
        index={index}
        enumerateQuestions={enumerateQuestions}
      />
      )}
      {response.type === 'radio' && (
      <RadioInput
        response={response}
        disabled={isDisabled || dontKnowCheckbox?.checked}
        answer={ans as { value: string }}
        index={index}
        enumerateQuestions={enumerateQuestions}
        otherValue={otherValue}
      />
      )}
      {response.type === 'checkbox' && (
      <CheckBoxInput
        response={response}
        disabled={isDisabled || dontKnowCheckbox?.checked}
        answer={ans as { value: string[] }}
        index={index}
        enumerateQuestions={enumerateQuestions}
        otherValue={otherValue}
      />
      )}
      {response.type === 'reactive' && (
      <Reactive
        response={response}
        answer={ans as { value: string[] }}
        index={index}
        enumerateQuestions={enumerateQuestions}
      />
      )}
      {(response.type === 'matrix-radio' || response.type === 'matrix-checkbox') && (
      <MatrixInput
        disabled={isDisabled || dontKnowCheckbox?.checked}
        response={response}
        answer={ans as { value: Record<string, string> }}
        index={index}
        enumerateQuestions={enumerateQuestions}
      />
      )}
      {response.type === 'buttons' && (
      <ButtonsInput
        response={response}
        disabled={isDisabled || dontKnowCheckbox?.checked}
        answer={ans as { value: string }}
        index={index}
        enumerateQuestions={enumerateQuestions}
      />
      )}
      {response.type === 'textOnly' && (
      <TextOnlyInput response={response} />
      )}
      {response.withDontKnow && (
      <Checkbox
        mt="xs"
        disabled={isDisabled}
        label="I don't know"
        classNames={{ input: classes.fixDisabled, label: classes.fixDisabledLabel, icon: classes.fixDisabledIcon }}
        {...dontKnowCheckbox}
        checked={dontKnowValue.checked}
        onChange={(event) => { dontKnowCheckbox?.onChange(event.currentTarget.checked); form.onChange(fieldInitialValue); }}
      />
      )}
      {responseDividers && <Divider mt="xl" mb="xs" />}
    </Box>
  );
}
