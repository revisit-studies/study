import { ResponseLocation } from '../../../parser/types';
import {saveTrialAnswer, useAppDispatch} from '../../../store';
import ResponseSwitcher from './ResponseSwitcher';
import {NextButton} from '../../NextButton';
import {Group} from '@mantine/core';
import {useCurrentStep} from '../../../routes';
import {useParams} from 'react-router-dom';
import {useNextTrialId, useTrialsConfig} from '../../../controllers/TrialController';
import {useForm} from '@mantine/form';
import {useMemo} from 'react';
import {useNextStep} from '../../../store/hooks/useNextStep';
import {useTrialStatus} from '../../../store/hooks/useTrialStatus';

type Props = {
    location: ResponseLocation;
};

export default function ResponseBlock({ location }: Props) {

    const trialConfig = useTrialsConfig();
    const responses = useMemo(() => trialConfig?.response.filter((response) => response.location === location) || [], [trialConfig, location]);

    const dispatch = useAppDispatch();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const { trialId = null } = useParams<{ trialId: string }>();
    const nextTrailId = useNextTrialId(trialId);
    const trialStatus = useTrialStatus(trialId);

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
                validateObj = {...validateObj, [response.id]: (value:string) => (value === undefined ? 'Empty input' : null)};
        });

        return validateObj;
    };

    const answerField = useForm({
        initialValues: generateInitFields(),
        validate: generateValidation(),
    });

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
                                saveTrialAnswer({
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
    ) : null;
}
