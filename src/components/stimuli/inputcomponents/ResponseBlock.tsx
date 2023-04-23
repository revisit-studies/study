import { Response } from '../../../parser/types';
import {saveTrialAnswer, useAppDispatch} from '../../../store';
import ResponseSwitcher from './ResponseSwitcher';
import {NextButton} from '../../NextButton';
import {Group, Text, Button} from '@mantine/core';
import {useCurrentStep} from '../../../routes';
import {useParams} from 'react-router-dom';
import {useNextTrialId} from '../../../controllers/utils';
import {useForm} from '@mantine/form';
import {useEffect, useState, useRef} from 'react';
import {useNextStep} from '../../../store/hooks/useNextStep';
import {useTrialStatus} from '../../../store/hooks/useTrialStatus';

type Props = {
    responses: Response[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    correctAnswer?: any;
    type: 'trials' | 'practice';
};

export default function ResponseBlock({ responses, correctAnswer, type }: Props) {

    const dispatch = useAppDispatch();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const { trialId = null } = useParams<{ trialId: string }>();
    const nextTrailId = useNextTrialId(trialId, type);
    const trialStatus = useTrialStatus(trialId, type);
    const [disableNext, setDisableNext] = useState(true);
    if (!responses || !trialStatus || !trialId) return <></>;


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
                validateObj = {...validateObj, [response.id]: (value: string | undefined) => (value === undefined ? 'Empty input' : null)};
        });

        return validateObj;
    };

    const answerField = useForm({
        initialValues: generateInitFields(),
        validate: generateValidation(),
    });

    const handleResponseCheck = () => {
          setDisableNext(!disableNext);
    };

    useEffect(() => {
        responses.forEach((response) => {
            const ans = trialStatus.answer ? JSON.parse(trialStatus.answer as string) : {};
            answerField.setFieldValue(response.id, ans[response.id] || '');
        });
    }, [trialStatus.answer]);

    return (
        <>
            <form onSubmit={answerField.onSubmit(console.log)}>
            {
                responses.map((response, index) => {
                    return (
                        <ResponseSwitcher key={index} status={trialStatus} answer={answerField.getInputProps(response.id)} response={response} />
                    );
                })
            }
            {!disableNext && <Text>The correct answer is: {correctAnswer}</Text>}
            <Group position="right" spacing="xs" mt="xl">
                {!(correctAnswer === null) ? <Button onClick={handleResponseCheck} disabled={!answerField.isValid()}>Check Answer</Button> : null}
                {nextTrailId ? (
                    <NextButton
                        disabled={correctAnswer !== null ? disableNext : !answerField.isValid()}
                        to={`/${currentStep}/${nextTrailId}`}
                        process={() => {
                            if (trialStatus.complete) {
                                answerField.setFieldValue('input', '');
                            }

                            const answer = JSON.stringify(answerField.values);
                            console.log(answer,'answer');

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
                )}
            </Group>
            </form>
        </>
    );
}
