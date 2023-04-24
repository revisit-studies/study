import { ResponseLocation } from '../../../parser/types';
import {saveTrialAnswer, useAppDispatch} from '../../../store';
import ResponseSwitcher from './ResponseSwitcher';
import {NextButton} from '../../NextButton';
import {Group, Text, Button} from '@mantine/core';
import {useCurrentStep} from '../../../routes';
import {useParams} from 'react-router-dom';
import {useNextTrialId, useTrialsConfig} from '../../../controllers/utils';
import {useForm} from '@mantine/form';
import {useState, useMemo, useEffect} from 'react';
import {useNextStep} from '../../../store/hooks/useNextStep';
import {useTrialStatus} from '../../../store/hooks/useTrialStatus';
import { updateResponseBlockValidation, useFlagsDispatch, useFlagsSelector } from '../../../store/flags';

type Props = {
    location: ResponseLocation;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    correctAnswer?: string | number;
};

export default function ResponseBlock({ location, correctAnswer  }: Props) {

    const trialConfig = useTrialsConfig();
    const type = trialConfig?.type;
    const responses = useMemo(() => trialConfig?.response.filter((response) => response.location === location) || [], [trialConfig, location]);

    const dispatch = useAppDispatch();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const { trialId = null } = useParams<{ trialId: string }>();
    const nextTrailId = useNextTrialId(trialId, type);
    const trialStatus = useTrialStatus(trialId, type);
    const [disableNext, setDisableNext] = useState(true);
    const showNextButton = useMemo(() => trialConfig?.nextButtonLocation === undefined ? location === 'belowStimulus' : trialConfig.nextButtonLocation === location, [location, trialConfig]);

    const flagStoreDispatch = useFlagsDispatch();
    const responseBlocksValid = useFlagsSelector((state: any) => state.responseBlocksValid);

    const generateInitFields = () => {
        let initObj = {};

        responses.forEach((response) => {
            initObj = {...initObj, [response.id]: ''};
        });

        return initObj;
    };

    const generateValidation = () => {
        let validateObj = {};

        responses.forEach((response) => {
            if(response.required)
                validateObj = {...validateObj, [response.id]: (value: string | undefined) => (value === undefined || value.length === 0 ? 'Empty input' : null)};
        });

        return validateObj;
    };

    const answerField = useForm({
        initialValues: generateInitFields(),
        validate: generateValidation(),
    });

    useEffect(() => {
        flagStoreDispatch(updateResponseBlockValidation({ location, status: answerField.isValid() }));
    });

    const handleResponseCheck = () => {
        setDisableNext(!disableNext);
    };

    return trialStatus !== null && trialId !== null && responses.length > 0 ? (
        <>
            <form onSubmit={answerField.onSubmit(console.log)}>
            {
                responses.map((response, index) => {
                    return (
                        <ResponseSwitcher key={index} answer={answerField.getInputProps(response.id)} response={response} />
                    );
                })
            }
            {!disableNext && <Text>The correct answer is: {correctAnswer}</Text>}
            <Group position="right" spacing="xs" mt="xl">
                {(correctAnswer !== undefined) ? <Button onClick={handleResponseCheck} disabled={!answerField.isValid()}>Check Answer</Button> : null}
                {showNextButton && (nextTrailId ? (
                    <NextButton
                        disabled={correctAnswer !== undefined ? disableNext : !Object.values(responseBlocksValid).every((x) => x)}
                        to={`/${currentStep}/${nextTrailId}`}
                        process={() => {
                            if (trialStatus.complete) {
                                answerField.setFieldValue('input', '');
                            }

                            const answer = JSON.stringify(answerField.values);

                            dispatch(
                                saveTrialAnswer({
                                    trialName: currentStep,
                                    trialId,
                                    answer: answer,
                                    type
                                })
                            );
                            setDisableNext(!disableNext);
                            answerField.setFieldValue('input', '');
                        }}
                    />
                ) : (
                    <NextButton
                        to={`/${nextStep}`}
                        disabled={correctAnswer === null || disableNext}
                        process={() => {
                            // complete trials
                        }}
                    />
                ))}
            </Group>
            </form>
        </>
    ) : null;
}
