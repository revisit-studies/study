import {Response} from '../../parser/types';
import {useForm} from '@mantine/form';

export const generateInitFields = (responses : Response[]) => {
    let initObj = {};

    responses.forEach((response) => {
        initObj = {...initObj, [response.id]: ''};
    });

    return initObj;
};

export const generateValidation = (responses : Response[]) => {
    const validationFunc = (type : string) => {

        if(type === 'iframe'){
            return function(value: Array<string>){return value.length===0;};
        }
        else if(type === 'numerical' || type === 'slider'){
            return  (value: string | number) => {
                return typeof value !== 'number';
            };
        }
        else{
            return function(value: string){return value.length===0;};}
    };

    let validateObj = {};

    responses.forEach((response) => {
        if(response.required)
            validateObj = {...validateObj, [response.id]: validationFunc(response.type)};
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

