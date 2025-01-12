# Welcome to the Advanced React Component Tutorial

In this tutorial, you will create a React component that could take parameters from the config file, and participants will interact with your component to set answer. 

In this study, the stimuli is a circle. The location of circle will based on parameters from the config file. 
When participants click on the circle, the distance between click and the center of the circle will be calculated and saved as the answer. We encourage you to complete the study to get familiar with the trial first.

## Checking the existing example
### Checking config and React component
- Check the `public/tutorial/advanced-react-component` folder. We have placed a base config file there. Also, check the `src/public/tutorial/advanced-react-component/assests/ClickCircle.tsx` to see a React component.
- After start the dev server locally, you can check the current status of the component (under tutorial tab). This component simply render a circle on SVG. 

### Passing parameters
- The React component could take parameters from the config file. 
  - In config file, in the "clickCircle" components, we have a parameters attributes. This is where you specify your parameters that passed to the React component.
  - In `ClickCircle.tsx`, we passed the "parameters" as the component props. Then we can extract data from it.
- The reVISit framework could take answers from the React component as well.
  - In config file, in the "clickCircle" component, the response type is "iframe". This type of response is used to receive answers from React component. Notice the id of this response is passed to React component by parameters.
  - In `ClickCircle.tsx`, you can see the setAnswer is passed to the component as props. Then you can use that function to pass answers back to reVISit. When you click on screen, the distance between click and the center of the circle will be calculated and saved as the answer.

## Exercise
- Now, you can modify the "cx" and "cy" parameters in the config file to move the circle.
- You can also duplicate the "ClickCircle" component inside the config file, give it a new name, change the "cx" and "cy" values, and then add your new component to the sequence. This will create a second trial in your study.
- Additionally, you can modify the answer you want to collect in ClickCircle.tsx. For example, you could change it to return the result based on whether participants click inside or outside the circle, or implement any other logic you'd like.
