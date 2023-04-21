import { Response } from '../../../parser/types';
import {saveSurvey, saveTrialAnswer, useAppDispatch} from '../../../store';
import ResponseSwitcher from './ResponseSwitcher';
import {NextButton} from '../../NextButton';
import { Group} from '@mantine/core';
import {useCurrentStep} from '../../../routes';
import {useParams} from 'react-router-dom';
import {useNextTrialId} from '../../../controllers/TrialController';
import {useEffect} from 'react';
import {useNextStep} from '../../../store/hooks/useNextStep';
import {useTrialStatus} from '../../../store/hooks/useTrialStatus';
import {createAnswerField} from './utils';
import {useSurvey} from '../../../store/hooks/useSurvey';

type Props = {
    responses: Response[];
    stage: string;
};

export default function ResponseBlock({ responses, stage}: Props) {

    const dispatch = useAppDispatch();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const { trialId = null } = useParams<{ trialId: string }>();
    const nextTrailId = useNextTrialId(trialId);
    const trialStatus = useTrialStatus(trialId);
    const survey = useSurvey();
    const answerField = createAnswerField(responses);

    {
        stage === 'trial' && trialStatus && useEffect(() => {
            responses.forEach((response) => {
                const ans = (trialStatus.answer && typeof trialStatus.answer === 'string') ? JSON.parse(trialStatus.answer) : {};
                answerField.setFieldValue(response.id, ans[response.id] || '');
            });
        }, [trialStatus.answer]);
    }

    {
        stage === 'survey' && useEffect(() => {
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
                            stage === 'trial'  ? <ResponseSwitcher key={index}  answer={answerField.getInputProps(response.id)} response={response} />
                        :
                           <ResponseSwitcher key={index} answer={answerField.getInputProps(response.id)} response={response} />
                    );
                })
            }

                <Group position="right" spacing="xs" mt="xl">
                    {stage === 'trial' && <NextButton
                        disabled={!answerField.isValid()}
                        to={ nextTrailId? `/${currentStep}/${nextTrailId}` : `/${nextStep}`}
                        process={() => {
                            const answer = JSON.stringify(answerField.values);
                            dispatch(
                                saveTrialAnswer({
                                    trialName: currentStep,
                                    trialId: trialId || 'NoID',
                                    answer: answer,
                                })
                            );
                        }}
                    />}

                    {stage === 'survey' && <NextButton
                        disabled={!answerField.isValid()}
                        to={`/${nextStep}`}
                        process={() => {
                            dispatch(
                                saveSurvey(answerField.values)
                            );
                        }}
                    />}

            </Group>
            </form>
        </>
    );
}
