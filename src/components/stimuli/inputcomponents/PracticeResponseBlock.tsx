import { Response } from '../../../parser/types';
import {savePracticeAnswer, useAppDispatch} from '../../../store';
import ResponseSwitcher from './ResponseSwitcher';
import {NextButton} from '../../NextButton';
import {Group} from '@mantine/core';
import {useCurrentStep} from '../../../routes';
import {useParams} from 'react-router-dom';
import {useNextTrialId} from '../../../controllers/TrialController';
import {useForm} from '@mantine/form';
import {useEffect} from 'react';
import {useNextStep} from '../../../store/hooks/useNextStep';
import {useTrialStatus} from '../../../store/hooks/useTrialStatus';

type Props = {
    responses: Response[];
};

export default function PracticeResponseBlock({ responses }: Props) {

    const dispatch = useAppDispatch();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const { trialId = null } = useParams<{ trialId: string }>();
    const nextTrailId = useNextTrialId(trialId);
    const trialStatus = useTrialStatus(trialId);

    if (!responses || !trialStatus || !trialId) return <></>;

    console.log(nextTrailId, trialId);
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
                validateObj = {...validateObj, [response.id]: (value:string) => (value.length === 0 ? 'Empty input' : null)};
        });

        return validateObj;
    };

    const answerField = useForm({
        initialValues: generateInitFields(),
        validate: generateValidation(),
    });

    useEffect(() => {
        responses.forEach((response) => {
            const ans = trialStatus.answer ? JSON.parse(trialStatus.answer) : {};
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

                <Group position="right" spacing="xs" mt="xl">
                {nextTrailId ? (
                    <NextButton
                        disabled={!answerField.isValid()}
                        to={`/${currentStep}/${nextTrailId}`}
                        process={() => {
                            if (trialStatus.complete) {
                                answerField.setFieldValue('input', '');
                            }

                            const answer = JSON.stringify(answerField.values);
                            console.log(answer,'answer');

                            dispatch(
                                savePracticeAnswer({
                                    trialName: currentStep,
                                    trialId,
                                    answer: answer,
                                })
                            );

                            answerField.setFieldValue('input', '');
                        }}
                    />
                ) : (
                    <NextButton
                        to={`/${nextStep}`}
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
