/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { parse as hjsonParse } from 'hjson';
import { StudyConfig, GlobalConfig, StudyMetadata, UIConfig, Option, Response, StudyComponent, StudyComponents, studyComponentTypes, ConsentComponent, SteppedComponent, responseTypes, responseBlockLocations, Trial, stimulusTypes, Stimulus, Answer } from './types';

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
    const basicVerified = typeof obj === 'object' &&
        obj !== null;

    // Check type for configsList
    const configsListVerified = Object.hasOwn((obj as object), 'configsList') &&
        (obj as GlobalConfig).configsList instanceof Array && 
        (obj as GlobalConfig).configsList.every((item) => typeof item === 'string');

    // Check type for configs
    const configsVerified = Object.hasOwn((obj as object), 'configs') &&
        (obj as GlobalConfig).configs instanceof Object && 
        Object.entries((obj as GlobalConfig).configs).every(([key, value]) => (
            typeof key === 'string' &&
            Object.entries(value).every(([innerKey, innerValue]) => ['title', 'path', 'description'].includes(innerKey) && typeof innerValue === 'string')
        ));

    const steps = ['basicVerified', 'configsListVerified', 'configsVerified'];
    return [basicVerified, configsListVerified, configsVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateStudyMetadata(obj: unknown): obj is StudyMetadata {
    const basicVerified = typeof obj === 'object' &&
        obj !== null;

    // Check type for title
    const titleVerified = Object.hasOwn((obj as object), 'title') &&
        typeof (obj as StudyMetadata).title === 'string' &&
        (obj as StudyMetadata).title.length > 0;

    // Check type for version
    const versionVerified = Object.hasOwn((obj as object), 'version') &&
        typeof (obj as StudyMetadata).version === 'string' &&
        (obj as StudyMetadata).version.length > 0;
        
    // Check type for authors
    const authorsVerified = Object.hasOwn((obj as object), 'authors') &&
        typeof (obj as StudyMetadata).authors === 'object' &&
        (obj as StudyMetadata).authors !== null &&
        (obj as StudyMetadata).authors instanceof Array &&
        (obj as StudyMetadata).authors.every((item) => typeof item === 'string');
        
    // Check type for date
    const dateVerified = Object.hasOwn((obj as object), 'date') &&
        typeof (obj as StudyMetadata).date === 'string' &&
        (obj as StudyMetadata).date.length > 0;
        
    // Check type for description
    const descriptionVerified = (Object.hasOwn((obj as object), 'description') ? (
        typeof (obj as StudyMetadata).description === 'string' &&
        (obj as StudyMetadata).description!.length > 0
    ) : true);

    // Check type for organization
    const organizationVerified = (Object.hasOwn((obj as object), 'organization') ? (
        typeof (obj as StudyMetadata).organization === 'object' &&
        (obj as StudyMetadata).organization !== null &&
        (obj as StudyMetadata).organization instanceof Array &&
        (obj as StudyMetadata).organization!.every((item) => typeof item === 'string')
    ) : true);

    const steps = ['basicVerified', 'titleVerified', 'versionVerified', 'authorsVerified', 'dateVerified', 'descriptionVerified', 'organizationVerified'];
    return [basicVerified, titleVerified, versionVerified, authorsVerified, dateVerified, descriptionVerified, organizationVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateUiConfig(obj: unknown): obj is UIConfig {
    const basicVerified = typeof obj === 'object' &&
        obj !== null;

    // Check type for contactEmail
    const contactEmailVerified = Object.hasOwn((obj as object), 'contactEmail') &&
        typeof (obj as UIConfig).contactEmail === 'string' &&
        (obj as UIConfig).contactEmail.length > 0;
        
    // Check type for helpTextPath
    const helpTextPathVerified = (Object.hasOwn((obj as object), 'helpTextPath') ? (
        typeof (obj as UIConfig).helpTextPath === 'string' &&
        (obj as UIConfig).helpTextPath!.length > 0
    ) : true);
        
    // Check type for logoPath
    const logoPathVerified = Object.hasOwn((obj as object), 'logoPath') &&
        typeof (obj as UIConfig).logoPath === 'string' &&
        (obj as UIConfig).logoPath.length > 0;

    // Check type for withProgressBar
    const withProgressBarVerified = Object.hasOwn((obj as object), 'withProgressBar') &&
        typeof (obj as UIConfig).withProgressBar === 'boolean';
        
    // Check type for autoDownloadStudy
    const autoDownloadStudyVerified = Object.hasOwn((obj as object), 'autoDownloadStudy') &&
        typeof (obj as UIConfig).autoDownloadStudy === 'boolean';

    // Check type for autoDownloadTime
    const autoDownloadTimeVerified = (Object.hasOwn((obj as object), 'autoDownloadTime') ? (
        typeof (obj as UIConfig).autoDownloadTime === 'number' &&
        (obj as UIConfig).autoDownloadTime! > 0
    ) : true);

    // Check type for sidebar
    const sidebarVerified = Object.hasOwn((obj as object), 'sidebar') &&
        typeof (obj as UIConfig).sidebar === 'boolean';

    const steps = ['basicVerified', 'contactEmailVerified', 'helpTextPathVerified', 'logoPathVerified', 'withProgressBarVerified', 'autoDownloadStudyVerified', 'autoDownloadTimeVerified', 'sidebarVerified'];
    return [basicVerified, contactEmailVerified, helpTextPathVerified, logoPathVerified, withProgressBarVerified, autoDownloadStudyVerified, autoDownloadTimeVerified, sidebarVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateComponents(obj: unknown): obj is StudyComponents {
    return typeof obj === 'object' &&
        obj !== null &&
        Object.entries(obj).every(([key, value]) => (
            typeof key === 'string' &&
            validateComponent(value)
        ));
}

function validateComponent(obj: unknown): obj is StudyComponent {
    const basicVerified = typeof obj === 'object' &&
        obj !== null;
        
    // Check type for type
    const typeVerified = Object.hasOwn((obj as object), 'type') &&
        typeof (obj as StudyComponent).type === 'string' &&
        studyComponentTypes.includes((obj as StudyComponent).type);

    // Check type for consent components
    const consentVerified =  ((obj as StudyComponent).type === 'consent' ? (
        Object.hasOwn((obj as object), 'path') &&
            typeof (obj as ConsentComponent).path === 'string' &&
            (obj as ConsentComponent).path.length > 0 &&
        
        Object.hasOwn((obj as object), 'signatureRequired') &&
            typeof (obj as ConsentComponent).signatureRequired === 'boolean'
    ) : true);

    // TODO: Check type for training components when we have more properties

    // Check type for practice components
    const practiceVerified = ((obj as StudyComponent).type === 'practice' ? (
        validateSteppedComponent(obj as StudyComponent)
    ) : true);

    // TODO: Check type for attentionTest components when we have more properties

    // Check type for trials components
    const trialsVerified = ((obj as StudyComponent).type === 'trials' ? (
        validateSteppedComponent(obj as StudyComponent)
    ) : true);

    // TODO: Check type for survey components
    
    const steps = ['basicVerified', 'typeVerified', 'consentVerified', 'practiceVerified', 'trialsVerified'];
    return [basicVerified, typeVerified, consentVerified, practiceVerified, trialsVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateSteppedComponent(obj: StudyComponent): obj is SteppedComponent {
    // Check type for order
    const orderVerified = Object.hasOwn(obj, 'order') &&
            typeof (obj as SteppedComponent).order === 'object' &&
            (obj as SteppedComponent).order !== null &&
            (obj as SteppedComponent).order instanceof Array &&
            (obj as SteppedComponent).order.every((item) => typeof item === 'string');
    
    // Check type for response
    const responseVerified = Object.hasOwn(obj, 'response') &&
            validateResponses((obj as SteppedComponent).response);

    // Check type for trials
    const trialsVerified = Object.hasOwn(obj, 'trials') &&
            typeof (obj as SteppedComponent).trials === 'object' &&
            (obj as SteppedComponent).trials !== null &&
            Object.entries((obj as SteppedComponent).trials).every(([key, value]) => (
                typeof key === 'string' &&
                validateTrial(value)
            ));
        
    // Check type for nextButtonLocation
    const nextButtonLocationVerified = (Object.hasOwn(obj, 'nextButtonLocation') ? (
            typeof (obj as SteppedComponent).nextButtonLocation === 'string' &&
            responseBlockLocations.includes((obj as SteppedComponent).nextButtonLocation!)
        ) : true);

    // Check type for instructionLocation
    const instructionLocationVerified = (Object.hasOwn(obj, 'instructionLocation') ? (
            typeof (obj as SteppedComponent).instructionLocation === 'string' &&
            responseBlockLocations.includes((obj as SteppedComponent).instructionLocation!)
        ) : true);
    
    const steps = ['orderVerified', 'responseVerified', 'trialsVerified', 'nextButtonLocationVerified', 'instructionLocationVerified'];
    return [orderVerified, responseVerified, trialsVerified, nextButtonLocationVerified, instructionLocationVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateResponses(obj: unknown): obj is Response[] {
    return typeof obj === 'object' &&
        obj !== null &&
        obj instanceof Array &&
        obj.every((item) => validateResponse(item));
}

function validateResponse(obj: unknown): obj is Response {
    const basicVerified = typeof obj === 'object' &&
        obj !== null;
        
    // Check type for id
    const idVerified = Object.hasOwn((obj as object), 'id') &&
        typeof (obj as Response).id === 'string' &&
        (obj as Response).id.length > 0;
        
    // Check type for prompt
    const promptVerified = Object.hasOwn((obj as object), 'prompt') &&
        typeof (obj as Response).prompt === 'string' &&
        (obj as Response).prompt.length > 0;

    // Check type for type
    const typeVerified = Object.hasOwn((obj as object), 'type') &&
        typeof (obj as Response).type === 'string' &&
        responseTypes.includes((obj as Response).type);

    // Check type for desc
    const descVerified = Object.hasOwn((obj as object), 'desc') &&
        typeof (obj as Response).desc === 'string' &&
        (obj as Response).desc!.length > 0;

    // Check type for required
    const requiredVerified = Object.hasOwn((obj as object), 'required') &&
        typeof (obj as Response).required === 'boolean';

    // Check type for options
    const optionsVerified = (Object.hasOwn((obj as object), 'options') ? (
        validateOptions((obj as Response).options)
    ) : true);

    // Check type for preset
    const presetVerified = (Object.hasOwn((obj as object), 'preset') ? (
        typeof (obj as Response).preset === 'string' &&
        (obj as Response).preset!.length > 0
    ) : true);

    // Check type for min
    const minVerified = (Object.hasOwn((obj as object), 'min') ? (
        typeof (obj as Response).min === 'number'
    ) : true);

    // Check type for max
    const maxVerified = (Object.hasOwn((obj as object), 'max') ? (
        typeof (obj as Response).max === 'number'
    ) : true);

    // Check type for location
    const locationVerified = (Object.hasOwn((obj as object), 'location') ? (
        typeof (obj as Response).location === 'string' &&
        responseBlockLocations.includes((obj as Response).location!)
    ) : true);

    const steps = ['basicVerified', 'idVerified', 'promptVerified', 'typeVerified', 'descVerified', 'requiredVerified', 'optionsVerified', 'presetVerified', 'minVerified', 'maxVerified', 'locationVerified'];
    return [basicVerified, idVerified, promptVerified, typeVerified, descVerified, requiredVerified, optionsVerified, presetVerified, minVerified, maxVerified, locationVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateOptions(obj: unknown): obj is Option[] {
    return typeof obj === 'object' &&
        obj !== null &&
        obj instanceof Array &&
        obj.every((item) => validateOption(item));
}

function validateOption(obj: unknown): obj is Option {
    const basicVerified = typeof obj === 'object' &&
        obj !== null;

    // Check type for label
    const labelVerified = Object.hasOwn((obj as object), 'label') &&
        typeof (obj as Option).label === 'string' &&
        (obj as Option).label.length > 0;

    // Check type for value
    const valueVerified = Object.hasOwn((obj as object), 'value') &&
        ((typeof (obj as Option).value === 'string' &&
        ((obj as Option).value as string).length > 0) ||
        (typeof (obj as Option).value === 'number'));

    const steps = ['basicVerified', 'labelVerified', 'valueVerified'];
    return [basicVerified, labelVerified, valueVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateTrial(obj: unknown): obj is Trial {
    const basicVerified = typeof obj === 'object' &&
        obj !== null;

    // Check type for description
    const descriptionVerified = Object.hasOwn((obj as object), 'description') &&
        typeof (obj as Trial).description === 'string' &&
        (obj as Trial).description.length > 0;

    // Check type for instruction
    const instructionVerified = Object.hasOwn((obj as object), 'instruction') &&
        typeof (obj as Trial).instruction === 'string' &&
        (obj as Trial).instruction.length > 0;

    // Check type for stimulus
    const stimulusVerified = Object.hasOwn((obj as object), 'stimulus') &&
        validateStimulus((obj as Trial).stimulus);

    // Check type for response
    const responseVerified = (Object.hasOwn((obj as object), 'response') ? (
        validateResponses((obj as Trial).response)
    ) : true);

    // Check type for correctAnswer
    const correctAnswerVerified = (Object.hasOwn((obj as object), 'correctAnswer') ? (
        validateAnswers((obj as Trial).correctAnswer)
    ) : true);

    const steps = ['basicVerified', 'descriptionVerified', 'instructionVerified', 'stimulusVerified', 'responseVerified', 'correctAnswerVerified'];
    return [basicVerified, descriptionVerified, instructionVerified, stimulusVerified, responseVerified, correctAnswerVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateStimulus(obj: unknown): obj is Stimulus {
    const basicVerified = typeof obj === 'object' &&
        obj !== null;

    // Check type for type
    const typeVerified = Object.hasOwn((obj as object), 'type') &&
        typeof (obj as Stimulus).type === 'string' &&
        stimulusTypes.includes((obj as Stimulus).type);

    // Check type for path
    const pathVerified =  (Object.hasOwn((obj as object), 'path') ? (
        typeof (obj as Stimulus).path === 'string' &&
        (obj as Stimulus).path!.length > 0
    ) : true);
    
    // Check type for style
    const styleVerified = (Object.hasOwn((obj as object), 'style') ? (
        typeof (obj as Stimulus).style === 'object' &&
        (obj as Stimulus).style !== null &&
        Object.keys((obj as Stimulus).style!).every((key) => (
            typeof key === 'string' 
        ))
    ) : true);

    // Check type for parameters
    const parametersVerified = (Object.hasOwn((obj as object), 'parameters') ? (
        typeof (obj as Stimulus).parameters === 'object' &&
        (obj as Stimulus).parameters !== null &&
        Object.keys((obj as Stimulus).parameters!).every((key) => (
            typeof key === 'string'
        ))
    ) : true);

    const steps = ['basicVerified', 'typeVerified', 'pathVerified', 'styleVerified', 'parametersVerified'];
    return [basicVerified, typeVerified, pathVerified, styleVerified, parametersVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateAnswers(obj: unknown): obj is Answer[] {
    return typeof obj === 'object' &&
        obj !== null &&
        obj instanceof Array &&
        obj.every((item) => validateAnswer(item));
}

function validateAnswer(obj: unknown): obj is Answer {
    const basicVerified = typeof obj === 'object' &&
        obj !== null;
        
    // Check type for id
    const idVerified = Object.hasOwn((obj as object), 'id') &&
        typeof (obj as Answer).id === 'string' &&
        (obj as Answer).id.length > 0;

    // Check type for answer
    const answerVerified = Object.hasOwn((obj as object), 'answer');

    // Check type for acceptableLow
    const acceptableLowVerified = (Object.hasOwn((obj as object), 'acceptableLow') ? (
        typeof (obj as Answer).acceptableLow === 'number'
    ) : true);

    // Check type for acceptableHigh
    const acceptableHighVerified = (Object.hasOwn((obj as object), 'acceptableHigh') ? (
        typeof (obj as Answer).acceptableHigh === 'number'
    ) : true);

    // Check type for answerCallback
    const answerCallbackVerified = (Object.hasOwn((obj as object), 'answerCallback') ? (
        typeof (obj as Answer).answerCallback === 'string'
    ) : true);

    // Check type for answerRegex
    const answerRegexVerified = (Object.hasOwn((obj as object), 'answerRegex') ? (
        typeof (obj as Answer).answerRegex === 'string'
    ) : true);

    const steps = ['basicVerified', 'idVerified', 'answerVerified', 'acceptableLowVerified', 'acceptableHighVerified', 'answerCallbackVerified', 'answerRegexVerified'];
    return [basicVerified, idVerified, answerVerified, acceptableLowVerified, acceptableHighVerified, answerCallbackVerified, answerRegexVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}

function validateStudyConfig(obj: unknown): obj is StudyConfig {
    const basicVerified = typeof obj === 'object' &&
        obj !== null;

        // Check type for configVersion
    const configVersionVerified = Object.hasOwn((obj as object), 'configVersion') &&
            typeof (obj as StudyConfig).configVersion === 'number' &&
            (obj as StudyConfig).configVersion >= 1;

        // Check type for studyMetadata
    const studyMetadataVerified = Object.hasOwn((obj as object), 'studyMetadata') &&
            validateStudyMetadata((obj as StudyConfig).studyMetadata);

        // Check type for uiConfig
    const uiConfigVerified = Object.hasOwn((obj as object), 'uiConfig') &&
            validateUiConfig((obj as StudyConfig).uiConfig);

        // Check type for components
    const componentsVerified = Object.hasOwn((obj as object), 'components') &&
            validateComponents((obj as StudyConfig).components);

        // Check type for sequence
    const sequenceVerified = Object.hasOwn((obj as object), 'sequence') &&
            typeof (obj as StudyConfig).sequence === 'object' &&
            (obj as StudyConfig).sequence !== null &&
            (obj as StudyConfig).sequence instanceof Array &&
            (obj as StudyConfig).sequence.every((item) => typeof item === 'string' && Object.keys((obj as StudyConfig).components).includes(item));

    
    const steps = ['basicVerified', 'configVersionVerified', 'studyMetadataVerified', 'uiConfigVerified', 'componentsVerified', 'sequenceVerified'];
    return [basicVerified, configVersionVerified, studyMetadataVerified, uiConfigVerified, componentsVerified, sequenceVerified].every((item, index) => {
        if (!item) {
            console.error(`Failed to validate ${steps[index]}`);
        }
        return item;
    });
}
