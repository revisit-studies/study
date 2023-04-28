import { Group, Button, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTrialsConfig, useSurveyConfig, useNextTrialId } from '../../controllers/utils';
import { ResponseLocation } from '../../parser/types';
import { useCurrentStep } from '../../routes';
import { useAppDispatch, saveSurvey, saveTrialAnswer } from '../../store';
import { useFlagsDispatch, useFlagsSelector, updateResponseBlockValidation } from '../../store/flags';
import { useNextStep } from '../../store/hooks/useNextStep';
import { useTrialStatus } from '../../store/hooks/useTrialStatus';
import { NextButton } from '../NextButton';
import ResponseSwitcher from './ResponseSwitcher';

type Props = {
    location: ResponseLocation;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    correctAnswer?: string | number;
};

export default function ResponseBlock({ location, correctAnswer  }: Props) {

    const trialConfig = useTrialsConfig();
    const surveyConfig = useSurveyConfig();
    const currentConfig = surveyConfig === null ? trialConfig : surveyConfig;
    const type = currentConfig?.type;
    const responses = useMemo(() => currentConfig?.response?.filter((response) => (response.location === location || (response.location === undefined && location === 'belowStimulus'))) || [], [currentConfig, location]);

    const dispatch = useAppDispatch();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const { trialId = null } = useParams<{ trialId: string }>();
    const nextTrailId = useNextTrialId(trialId, type);
    const trialStatus = useTrialStatus(trialId, type);
    const [disableNext, setDisableNext] = useState(true);
    const showNextButton = useMemo(() => currentConfig?.nextButtonLocation === undefined ? location === 'belowStimulus' : currentConfig.nextButtonLocation === location, [location, currentConfig]);

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

    return <>{responses.length > 0 ? (
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
            </form>
        </>
    ) : null}
    <Group position="right" spacing="xs" mt="xl">
        {(correctAnswer !== undefined && type === 'practice') ? <Button onClick={handleResponseCheck} disabled={!answerField.isValid()}>Check Answer</Button> : null}
        {showNextButton && 
            <NextButton
                disabled={type === 'practice' ? disableNext : !Object.values(responseBlocksValid).every((x) => x)}
                to={nextTrailId? `/${currentStep}/${nextTrailId}` : `/${nextStep}`}
                process={() => {
                    const answer = JSON.stringify(answerField.values);
                    answerField.setValues(generateInitFields());
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
            />}
        </Group>
    </>;
}
