Tech Stack
- Yarn
- React 18
- TypeScript
- Vite
- Mantine UI
- Firebase/Supabase both with storage and database
- Redux for state management with our in-house library Trrack.js for provenance tracking
- Specific Lodash functions (debounce, throttle, isEqual, merge)
- React Router for routing
- Eslint and airbnb style guide for code quality

Purpose
The ReVISit project aims to create a robust platform for conducting and analyzing user studies focused on interactive data visualization tools. By leveraging modern web technologies and state management solutions, ReVISit provides researchers with the necessary tools to design, deploy, and evaluate visualization interfaces effectively.

The goal is to expand the scope of user studies to beyond the visualization community, making it easier for researchers from various fields to conduct studies on interactive data visualizations. This means we need state management that can handle complex interactions and data flows, as well as a user-friendly interface for both study designers and participants.

Verbiage
- "Study Designer": The individual who creates and configures the user study.
- "Participant": The user who takes part in the study.
- "Analyst": The individual who reviews and analyzes the data collected from the study, both in the platform and externally.
- "Study Config": The configuration file that defines the parameters and settings of a user study.

Study Configs
The study configurations are defined in JSON files with schemas. These configs specify various aspects of the study, including the visualization tools to be used, the tasks participants need to complete, and the data sources involved. You can find the full definition of the study config schema in the typescript file at src/parser/types.ts. The answers and participant data specifications are stored separately from the study config to allow for flexibility in data collection and analysis, at src/store/types.ts.

Imported Libraries
We provide several libraries to facilitate the development of user studies, such as vlat, mini-vlat, nasa-tlx, color-blindness, and more. These libraries are components and sequences that are defined in public/libraries/. Each library has its own folder containing the necessary code and assets. You can import these libraries into your study configs to enhance the functionality and user experience of your studies by adding the libraries to the top level `importedLibraries` field in the study config, and then referencing the components in the `baseComponent` field or in sequences and the sequences in the `sequences` field. When referencing the components and sequences use the following syntax `"$libraryName.components.componentName"` and `"$libraryName.sequences.sequenceName"` respectively.

Storage Engines
ReVISit supports multiple storage backends for storing study data, including Firebase and Supabase. This allows researchers to choose the backend that best fits their needs in terms of scalability, ease of use, and integration with other tools. The storage engines are abstracted in the codebase, allowing for easy addition of new storage solutions in the future. The storage engine implementations can be found in src/storage/ directory.

How you should interact with the codebase
When working with the ReVISit codebase, work only with the source code files available to you. If you need an external library, please ask for approval first (and include how well used the library is). Make sure to follow best practices for React and TypeScript development, including proper state management, component structuring, and code documentation. Pay extra attention to lifecycle methods and hooks to ensure optimal performance and avoid memory leaks, including any updates to existing code. If you encounter any issues or have suggestions for improvements, feel free to bring them up for discussion. Don't interact with git and GitHub directly; instead, focus on the code itself. I'll handle version control and repository management. Always check package.json for the scripts available to you for building, testing, and running the project.

Testing
When adding a new feature or modifying code try to maximize unit test coverage. Unit tests should be colocated with the files they are testing, have the same names as the file with .spec., and use the vitest framework. Apply this to both UI/react code as well as non-UI code. For UI code, we use playwright for end-to-end testing. Try to add e2e tests for any new features that involve user interaction. E2E tests are located in the tests/ directory at the root of the project. Don't run `yarn test` directly; instead, describe the tests you want to run, and I'll handle executing them. You can run unittests locally using `yarn unittest`.
