import { parse as hjsonParse } from 'hjson';
import { StudyConfig, GlobalConfig } from './types';

export function parseGlobalConfig(fileData: string) {
    const data = hjsonParse(fileData);
    
    if (validateGlobalConfig(data)) {
        return data;
    } else {
        throw Error('There was an issue validating your file');
    }
}

export function parseStudyConfig(fileData: string) {
    const data = hjsonParse(fileData);
    
    if (validateStudyConfig(data)) {
        return data;
    } else {
        throw Error('There was an issue validating your file');
    }
}

function validateGlobalConfig(obj: unknown): obj is GlobalConfig {
    // TODO: actually check if we have a valid config
    // throw Error("There was an issue validating your file");
    return true;
}

function validateStudyConfig(obj: unknown): obj is StudyConfig {
    // TODO: actually check if we have a valid config
    // throw Error("There was an issue validating your file");
    return true;
}

// We can use this type of logic to check the subpieces of the template
// function isA(obj: unknown): obj is A {
//     // return boolean here
// }