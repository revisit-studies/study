import {Response} from '../../parser/types';
import {useForm} from '@mantine/form';

 const generateInitFields = (responses: Response[]) => {
    let initObj = {};
    responses.forEach((response) => {
        initObj = {...initObj, [response.id]: null};
    });
    return initObj;
};
 const generateValidation = (responses: Response[]) => {
    let validateObj = {};
    responses.forEach((response) => {
        if(response.required){
            validateObj = {...validateObj, [response.id]: (value:string) => (!value ? 'Empty input' : null)};
        }
    });
    return validateObj;
};


 export const createAnswerField = (responses: Response[]) => {
     // eslint-disable-next-line react-hooks/rules-of-hooks
     const answerField = useForm({
         initialValues: generateInitFields(responses),
         validate: generateValidation(responses),
     });
     return answerField;
 };