# Welcome to the Advanced React Component Tutorial

In this tutorial, you will create a React component that could take parameters from the config file, and participants will interact with your component to set answer. 

In this study, the stimuli is a circle. The location of circle will based on parameters from the config file. 
When participants click on the circle, the distance between click and the center of the circle will be calculated and saved as the answer

1. Check public/tutoiral/advancded-react-component folder, we have put a base config file in that folder. Check src/tutorial/public/advanced-react-component folder, you will see a React component
2. You may also start the dev serve and check current status of the component.
3. Add a new trial to the config file, the trial type should be "react-component". Also add other attributes of the trial, such as nextButtonLocation, description,instruction. You can find similar example for following steps here: https://revisit.dev/docs/designing-studies/react-stimulus/
4. Add "parameters" attribute to this trial, the parameters should have taskid, x and y location for the circle.
5. Add "response" attribute to this trial, the response type will be iframe.
5. Add your new trial to the sequence. We are done with the config file.
6. Now go to the React component. Extract taskid, x an y location from the parameters.
7. Use the extracted x and y coordinates when plot the circle in SVG. 
8. We have calculated the answer for you. Simply use setAnswer function to save the answer. 
9. Test your study. 


