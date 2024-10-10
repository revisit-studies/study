# Welcome to the Advanced React Component Tutorial

In this tutorial, you will create a React component that could take parameters from the config file, and participants will interact with your component to set answer. 

In this study, the stimuli is a circle. The location of circle will based on parameters from the config file. 
When participants click on the circle, the distance between click and the center of the circle will be calculated and saved as the answer

- Check the public/tutorial/advanced-react-component folder. We have placed a base config file there. Also, check the src/tutorial/public/advanced-react-component folder to see a React component.
- You can start the dev server to check the current status of the component. This component simply render a circle on SVG. 
- The React component could take parameters from the config file. 
  - In config file, in the "clickCircle" components, we have a parameters attributes. This is where you specify your parameters that passed to React component.
  - In ClickCircle.tsx, you can see we passed the "parameters" as the component props. Then we can extract data from it.
- The reVISit framework could take answers from the React component as well.
  - In config file, in the "clickCircle" component, the response type is "iframe". This type of response is used to receive answers from React component. Notice the id of this response is passed to React component by parameters.
  - In ClickCircle.tsx, you can see the setAnswer is passed to the component as props. Then you can use that function to pass answers back to reVISit.
- Now you can try to modify "cx" and "cy" in parameters to move the circle. 
- You may also try to copy the "clickCircle" component, give it another name, change "cx" and "cy", then add your new component to sequence, so this study will have 2 trials. 
- You can also try to change the setAnswer content in ClickCircle.tsx. e.g. change it to return the result if participants click inside or outside the circle 

