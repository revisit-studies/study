import { Response } from '../../../parser/types';
import {savePracticeAnswer, useAppDispatch} from '../../../store';
import ResponseSwitcher from './ResponseSwitcher';
import {NextButton} from '../../NextButton';
import {Group, Text, Button} from '@mantine/core';
import {useCurrentStep} from '../../../routes';
import {useParams} from 'react-router-dom';
import {useNextPracticeId} from '../../../controllers/PracticeController';
import {useForm} from '@mantine/form';
import {useEffect, useState} from 'react';
import {useNextStep} from '../../../store/hooks/useNextStep';
import {useTrialStatus} from '../../../store/hooks/useTrialStatus';

type Props = {
    responses: Response[];
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    correctAnswer?: any;
};

export default function PracticeResponseBlock({ responses, correctAnswer }: Props) {

    const dispatch = useAppDispatch();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const { trialId: practiceId = null } = useParams<{ trialId: string }>();
    const nextPracticeId = useNextPracticeId(practiceId);
    const practiceStatus = useTrialStatus(practiceId);
    const [disableNext, setDisableNext] = useState(true);
    const [correctAnswers, setCorrectAnswers] = useState(0);

    if (!responses || !practiceStatus || !practiceId) return <></>;

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

    const handleResponseCheck = () => {
        if (JSON.stringify(answerField.values) === correctAnswer) 
          setCorrectAnswers(correctAnswers + 1);
        setDisableNext(false);
    };

    useEffect(() => {
        responses.forEach((response) => {
            const ans = practiceStatus.answer ? JSON.parse(practiceStatus.answer as string) : {};
            answerField.setFieldValue(response.id, ans[response.id] || '');
        });
    }, [practiceStatus.answer]);
    console.log(answerField.isValid(), !disableNext);

    return (
        <>
            <form>
            {
                responses.map((response, index) => {
                    return (
                        <ResponseSwitcher key={index} status={practiceStatus} answer={answerField.getInputProps(response.id)} response={response} />
                    );
                })
            }
            {!disableNext && (<Text>The correct answer is: {correctAnswer}</Text>)}

            <Group position="right" spacing="xs" mt="xl">
                <Button onClick={handleResponseCheck} disabled={!answerField.isValid()}>Check Answer</Button>
                {nextPracticeId ? (
                    <NextButton
                        disabled={disableNext}
                        to={`/${currentStep}/${nextPracticeId}`}
                        process={() => {
                            if (practiceStatus.complete) {
                                answerField.setFieldValue('input', '');
                            }

                            const answer = JSON.stringify(answerField.values);

                            dispatch(
                                savePracticeAnswer({
                                    practiceName: currentStep,
                                    practiceId,
                                    answer: answer,
                                })
                            );
                            setDisableNext(true);
                            answerField.setFieldValue('input', '');
                        }}
                    />
                ) : (
                    <NextButton
                        to={`/${nextStep}`}
                        disabled={disableNext}
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
