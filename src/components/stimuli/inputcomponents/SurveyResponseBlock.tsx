import { Response } from "../../../parser/types";
import {saveTrialAnswer, useAppDispatch} from "../../../store";
import ResponseSwitcher from "./ResponseSwitcher";
import {NextButton} from "../../NextButton";
import {Button, Group} from "@mantine/core";
import {useCurrentStep} from "../../../routes";
import {useParams} from "react-router-dom";
import {createTrialProvenance} from "../../../store/trialProvenance";
import {useNextTrialId, useTrialsConfig} from "../../../controllers/TrialController";
import {useForm} from "@mantine/form";
import {useEffect} from "react";
import {useNextStep} from "../../../store/hooks/useNextStep";
import {useTrialStatus} from "../../../store/hooks/useTrialStatus";

type Props = {
    responses: Response[];
};

export default function SurveyResponseBlock({ responses }: Props) {

    const dispatch = useAppDispatch();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const config = useTrialsConfig();


    const generateInitFields = () => {
        let initObj = {};

        responses.forEach((response) => {
            initObj = {...initObj, [response.id]: ""};
        });
        return initObj;
    }
    const generateValidation = () => {
        let validateObj = {};

        responses.forEach((response) => {
            if(response.required)
                validateObj = {...validateObj, [response.id]: (value:string) => (value.length === 0 ? 'Empty input' : null)};
        });
        return validateObj;
    }

    const answerField = useForm({
        initialValues: generateInitFields(),
        validate: generateValidation(),
    });

    useEffect(() => {

    }, []);

    return (
        <>
            <form onSubmit={answerField.onSubmit(console.log)}>
            {
                responses.map((response, index) => {
                    return (
                        <ResponseSwitcher key={index} answer={answerField.getInputProps(response.id)} response={response} />
                    )
                })
            }

                <Group position="right" spacing="xs" mt="xl">

                        <NextButton
                            disabled={!answerField.isValid()}
                            to={`/${nextStep}`}
                            process={() => {
                                const answer = JSON.stringify(answerField.values);
                                console.log(answer,"answer")

                                dispatch(
                                    saveTrialAnswer({
                                        trialName: currentStep,
                                        trialId:"survey",
                                        answer: answer,
                                    })
                                );

                                answerField.setFieldValue("input", "");
                            }}
                        />

                </Group>
            </form>
        </>
    );
}
