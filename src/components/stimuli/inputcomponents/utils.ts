import {Response} from "../../../parser/types";

export const generateInitFields = (responses: Response[]) => {
    let initObj = {};
    responses.forEach((response) => {
        initObj = {...initObj, [response.id]: null};
    });
    return initObj;
}
export const generateValidation = (responses: Response[]) => {
    let validateObj = {};
    responses.forEach((response) => {
        if(response.required){
            validateObj = {...validateObj, [response.id]: (value:string) => (!value ? 'Empty input' : null)};
        }
    });
    return validateObj;
}