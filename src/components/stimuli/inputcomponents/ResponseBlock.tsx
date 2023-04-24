import { Response } from '../../../parser/types';
import {saveSurvey, saveTrialAnswer, useAppDispatch} from '../../../store';
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
import {useSurvey} from '../../../store/hooks/useSurvey';

type Props = {
    responses: Response[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    correctAnswer?: any;
    type: 'trials' | 'practice' | 'survey';
};

export default function ResponseBlock({ responses, correctAnswer, type }: Props) {

    const dispatch = useAppDispatch();
    const survey = useSurvey();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const { trialId = null } = useParams<{ trialId: string }>();
    const nextTrailId = useNextTrialId(trialId, type);
    const trialStatus = type === 'survey' ? {answer:survey} :useTrialStatus(trialId, type);
    const [disableNext, setDisableNext] = useState(true);
    if (!responses || !trialStatus ) return <>Invalid Response setting</>;

    const answerField = createAnswerField(responses);

    const handleResponseCheck = () => {
        setDisableNext(!disableNext);
    };


    {
        type !== 'survey' && trialStatus && useEffect(() => {
            responses.forEach((response) => {
                const ans = (trialStatus.answer && typeof trialStatus.answer === 'string') ? JSON.parse(trialStatus.answer) : {};
                answerField.setFieldValue(response.id, ans[response.id] || '');
            });
        }, [trialStatus.answer]);
    }

    {
        type === 'survey' && useEffect(() => {
            for (const [key, value] of Object.entries(survey)) {
                answerField.setFieldValue(key,value);
            }
        }, [survey]);
    }


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
                    {correctAnswer && type === 'practice' ? <Button onClick={handleResponseCheck} disabled={!answerField.isValid()}>Check Answer</Button> : null}
                    <NextButton
                        disabled={type === 'practice' ? disableNext : !answerField.isValid()}
                        to={ nextTrailId? `/${currentStep}/${nextTrailId}` : `/${nextStep}`}
                        process={() => {
                            const answer = JSON.stringify(answerField.values);
                            console.log(answer,'answer');
                            if(type === 'survey'){
                                dispatch(
                                    saveSurvey(answerField.values)
                                );
                            }else{
                                dispatch(
                                    saveTrialAnswer({
                                        trialName: currentStep,
                                        trialId: trialId || 'NoID',
                                        answer: answer,
                                        type
                                    })
                                );
                                setDisableNext(!disableNext);
                            }

                        }}
                    />
                </Group>
            </form>
        </>
    );
}
