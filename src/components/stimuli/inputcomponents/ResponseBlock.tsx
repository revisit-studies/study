import { Response } from '../../../parser/types';
import {saveTrialAnswer, useAppDispatch} from '../../../store';
import ResponseSwitcher from './ResponseSwitcher';
import {NextButton} from '../../NextButton';
import {Group, Text, Button} from '@mantine/core';
import {useCurrentStep} from '../../../routes';
import {useParams} from 'react-router-dom';
import {useNextTrialId} from '../../../controllers/utils';
import {useEffect, useState, useRef} from 'react';
import {useNextStep} from '../../../store/hooks/useNextStep';
import {useTrialStatus} from '../../../store/hooks/useTrialStatus';
import {createAnswerField} from './utils';

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

    const answerField = createAnswerField(responses);

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
                    <NextButton
                        disabled={correctAnswer !== null ? disableNext : !answerField.isValid()}
                        to={ nextTrailId? `/${currentStep}/${nextTrailId}` : `/${nextStep}`}
                        process={() => {
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
                        }}
                    />
                </Group>
            </form>
        </>
    );
}
