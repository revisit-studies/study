import path from 'path';
import Ajv from 'ajv';

// Load the actual JSON schemas from the Revisit project
let globalConfigSchema: any = null;
let studyConfigSchema: any = null;
let globalValidate: any = null;
let studyValidate: any = null;

export async function loadSchemas() {
  try {
    const fs = await import('fs/promises');
    
    // Load global config schema
    const globalSchemaPath = path.join(__dirname, '..', '..', 'src', 'parser', 'GlobalConfigSchema.json');
    const globalSchemaContent = await fs.readFile(globalSchemaPath, 'utf-8');
    globalConfigSchema = JSON.parse(globalSchemaContent);
    
    // Load study config schema
    const studySchemaPath = path.join(__dirname, '..', '..', 'src', 'parser', 'StudyConfigSchema.json');
    const studySchemaContent = await fs.readFile(studySchemaPath, 'utf-8');
    studyConfigSchema = JSON.parse(studySchemaContent);
    
    // Initialize AJV validators
    const ajv1 = new Ajv();
    ajv1.addSchema(globalConfigSchema);
    globalValidate = ajv1.getSchema('#/definitions/GlobalConfig');
    
    const ajv2 = new Ajv();
    ajv2.addSchema(studyConfigSchema);
    studyValidate = ajv2.getSchema('#/definitions/StudyConfig');
    
  } catch (error) {
    console.error('Failed to load schemas:', error);
  }
}

// Validation function for global config (following Revisit's approach)
export function validateGlobalConfig(data: any): { isValid: boolean; errors: any[] } {
  if (!globalValidate) {
    return { isValid: false, errors: [{ message: 'Schema not loaded' }] };
  }
  
  const schemaValid = globalValidate(data) as boolean;
  const schemaErrors = globalValidate.errors || [];
  
  // Additional custom validation (like Revisit's verifyGlobalConfig)
  const customErrors: any[] = [];
  if (data.configsList && data.configs) {
    data.configsList.forEach((configName: string) => {
      if (!data.configs[configName]) {
        customErrors.push({ 
          message: `Config ${configName} is not defined in configs object, but is present in configsList`,
          instancePath: '/configsList',
          params: { action: 'add the config to the configs object or remove it from configsList' }
        });
      }
    });
  }
  
  return {
    isValid: schemaValid && customErrors.length === 0,
    errors: [...schemaErrors, ...customErrors]
  };
}

// Helper function to check if a component is an inherited component
export function isInheritedComponent(comp: any): boolean {
  return comp && typeof comp === 'object' && comp.baseComponent !== undefined;
}

// Helper function to check if a sequence is a dynamic block
export function isDynamicBlock(sequence: any): boolean {
  return sequence && sequence.order === 'dynamic';
}

// Helper function to get flat map of components from sequence (including interruptions)
export function getSequenceFlatMapWithInterruptions(sequence: any): string[] {
  const components: string[] = [];
  
  if (isDynamicBlock(sequence)) {
    return components; // Dynamic blocks can't be statically analyzed
  }
  
  if (!sequence.components || !Array.isArray(sequence.components)) {
    return components;
  }
  
  sequence.components.forEach((component: any) => {
    if (typeof component === 'string') {
      components.push(component);
    } else if (component && typeof component === 'object') {
      // Recursively handle nested blocks
      components.push(...getSequenceFlatMapWithInterruptions(component));
    }
  });
  
  // Handle interruptions
  if (sequence.interruptions && Array.isArray(sequence.interruptions)) {
    sequence.interruptions.forEach((interruption: any) => {
      if (interruption.components && Array.isArray(interruption.components)) {
        interruption.components.forEach((comp: any) => {
          if (typeof comp === 'string') {
            components.push(comp);
          }
        });
      }
    });
  }
  
  return components;
}

// Helper function to verify skip logic
export function verifyStudySkip(
  sequence: any,
  skipTargets: string[] = [],
  errors: any[] = []
): string[] {
  if (isDynamicBlock(sequence)) {
    return skipTargets; // Can't verify skip logic for dynamic blocks
  }

  // Base case: empty sequence
  if (!sequence.components || sequence.components.length === 0) {
    errors.push({
      message: 'Sequence has an empty components array',
      instancePath: '/sequence/',
      params: { action: 'remove empty components block' },
    });
    return skipTargets;
  }

  // If the block has an ID, remove it from the skipTargets array
  if (sequence.id) {
    const idxToRemove = skipTargets
      .map((target, idx) => (target === sequence.id ? idx : null))
      .filter(idx => idx !== null);
    idxToRemove.forEach((idx, i) => {
      skipTargets.splice(idx - i, 1);
    });
  }

  // Process components
  sequence.components.forEach((component: any) => {
    if (typeof component === 'string') {
      // If the component is a string, check if it is in the skipTargets array
      const idxToRemove = skipTargets
        .map((target, idx) => (target === component ? idx : null))
        .filter(idx => idx !== null);
      idxToRemove.forEach((idx, i) => {
        skipTargets.splice(idx - i, 1);
      });
    } else if (component && typeof component === 'object') {
      // Recursive case: component is a block
      verifyStudySkip(component, skipTargets, errors);
    }
  });

  // If this block has a skip, add the skip.to component to the skipTargets array
  if (sequence.skip && Array.isArray(sequence.skip)) {
    sequence.skip.forEach((skip: any) => {
      if (skip.to && skip.to !== 'end') {
        skipTargets.push(skip.to);
      }
    });
  }

  return skipTargets;
}

// Validation function for study config (following Revisit's approach)
export function validateStudyConfig(data: any): { isValid: boolean; errors: any[] } {
  if (!studyValidate) {
    return { isValid: false, errors: [{ message: 'Schema not loaded' }] };
  }
  
  const schemaValid = studyValidate(data) as boolean;
  const schemaErrors = studyValidate.errors || [];
  
  // Additional custom validation (like Revisit's verifyStudyConfig)
  const customErrors: any[] = [];
  
  if (data.components && typeof data.components === 'object') {
    Object.entries(data.components).forEach(([componentName, component]: [string, any]) => {
      // Verify baseComponent is defined in baseComponents object
      if (isInheritedComponent(component) && !data.baseComponents?.[component.baseComponent]) {
        customErrors.push({
          message: `Base component \`${component.baseComponent}\` is not defined in baseComponents object`,
          instancePath: `/components/${componentName}`,
          params: { action: 'add the base component to the baseComponents object' },
        });
      }
    });
  }

  // Verify components are well defined in sequence
  if (data.sequence) {
    const usedComponents = getSequenceFlatMapWithInterruptions(data.sequence);
    
    usedComponents.forEach((componentName) => {
      // Verify component is defined in components object
      if (!data.components?.[componentName]) {
        const isBaseComponent = data.baseComponents?.[componentName];
        customErrors.push({
          message: isBaseComponent
            ? `Component \`${componentName}\` is a base component and cannot be used in the sequence`
            : `Component \`${componentName}\` is not defined in components object`,
          instancePath: '/sequence/',
          params: { action: 'add the component to the components object' },
        });
      }
    });
  }

  // Verify skip blocks are well defined
  if (data.sequence) {
    const missingSkipTargets = verifyStudySkip(data.sequence, [], customErrors);
    missingSkipTargets.forEach((skipTarget) => {
      customErrors.push({
        message: `Skip target \`${skipTarget}\` does not occur after the skip block it is used in`,
        instancePath: '/sequence/',
        params: { action: 'add the target to the sequence after the skip block' },
      });
    });
  }

  // Validate response types and their properties
  if (data.components && typeof data.components === 'object') {
    Object.entries(data.components).forEach(([componentName, component]: [string, any]) => {
      if (component.response && Array.isArray(component.response)) {
        component.response.forEach((response: any, responseIndex: number) => {
          const responsePath = `/components/${componentName}/response/${responseIndex}`;
          
          // Validate response type
          if (!response.type) {
            customErrors.push({
              message: 'Response must have a type',
              instancePath: responsePath,
              params: { action: 'specify a response type' },
            });
          }
          
          // Validate new response types
          if (response.type === 'textOnly') {
            // TextOnly responses don't need required fields
            if (response.required !== undefined) {
              customErrors.push({
                message: 'TextOnly responses cannot be required',
                instancePath: responsePath,
                params: { action: 'remove the required field from TextOnly response' },
              });
            }
          }
          
          // Validate matrix responses
          if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
            if (!response.answerOptions) {
              customErrors.push({
                message: 'Matrix responses must have answerOptions',
                instancePath: responsePath,
                params: { action: 'add answerOptions to matrix response' },
              });
            }
            if (!response.questionOptions || !Array.isArray(response.questionOptions)) {
              customErrors.push({
                message: 'Matrix responses must have questionOptions array',
                instancePath: responsePath,
                params: { action: 'add questionOptions array to matrix response' },
              });
            }
          }
          
          // Validate buttons responses
          if (response.type === 'buttons') {
            if (!response.options || !Array.isArray(response.options)) {
              customErrors.push({
                message: 'Buttons responses must have options array',
                instancePath: responsePath,
                params: { action: 'add options array to buttons response' },
              });
            }
          }
          
          // Validate slider responses
          if (response.type === 'slider') {
            if (!response.options || !Array.isArray(response.options)) {
              customErrors.push({
                message: 'Slider responses must have options array',
                instancePath: responsePath,
                params: { action: 'add options array to slider response' },
              });
            }
          }
        });
      }
    });
  }

  // Validate library usage if importedLibraries are present
  if (data.importedLibraries && Array.isArray(data.importedLibraries)) {
    data.importedLibraries.forEach((libraryName: string, index: number) => {
      if (typeof libraryName !== 'string' || !libraryName.trim()) {
        customErrors.push({
          message: 'Library name must be a non-empty string',
          instancePath: `/importedLibraries/${index}`,
          params: { action: 'provide a valid library name' },
        });
      }
    });
  }

  // Validate UI config enhancements
  if (data.uiConfig) {
    const uiConfig = data.uiConfig;
    
    // Validate screen recording requirements
    if (uiConfig.recordScreen && uiConfig.recordScreenFPS) {
      if (typeof uiConfig.recordScreenFPS !== 'number' || uiConfig.recordScreenFPS <= 0) {
        customErrors.push({
          message: 'recordScreenFPS must be a positive number',
          instancePath: '/uiConfig/recordScreenFPS',
          params: { action: 'provide a valid FPS value' },
        });
      }
    }
    
    // Validate screen size requirements
    if (uiConfig.minWidthSize && (typeof uiConfig.minWidthSize !== 'number' || uiConfig.minWidthSize <= 0)) {
      customErrors.push({
        message: 'minWidthSize must be a positive number',
        instancePath: '/uiConfig/minWidthSize',
        params: { action: 'provide a valid width size' },
      });
    }
    
    if (uiConfig.minHeightSize && (typeof uiConfig.minHeightSize !== 'number' || uiConfig.minHeightSize <= 0)) {
      customErrors.push({
        message: 'minHeightSize must be a positive number',
        instancePath: '/uiConfig/minHeightSize',
        params: { action: 'provide a valid height size' },
      });
    }
  }
  
  return {
    isValid: schemaValid && customErrors.length === 0,
    errors: [...schemaErrors, ...customErrors]
  };
}
