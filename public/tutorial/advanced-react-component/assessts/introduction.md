# Welcome to the Advanced React Component Tutorial

In this tutorial, you will create a React component that could take parameters from the config file, and participants will interact with your component to set answer. 

In this study, the stimuli is a circle. The location of circle will based on parameters from the config file. 
When participants click on the circle, the distance between click and the center of the circle will be calculated and saved as the answer

- Check the public/tutorial/advanced-react-component folder. We have placed a base config file there. Also, check the src/tutorial/public/advanced-react-component folder to see a React component.
- You can start the dev server to check the current status of the component.
- Add a new trial to the config file. The trial type should be "react-component". Also, include other attributes for the trial, such as nextButtonLocation, description, and instruction. You can find similar examples here: https://revisit.dev/docs/designing-studies/react-stimulus/
- Add the "parameters" attribute to this trial, which should include the task ID, and the x and y coordinates for the circle.
- Add the "response" attribute to this trial, with the response type as iframe.
- Add your new trial to the sequence. The config file is now complete.
- Move on to the React component. Extract the task ID and x, y coordinates from the parameters.
- Use the extracted x and y coordinates to plot the circle in SVG.
- The distance between the click and the center of the circle has already been calculated for you. Use the setAnswer function to save the answer.
- Test your study.

