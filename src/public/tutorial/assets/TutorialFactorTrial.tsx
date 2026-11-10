import ReactExample from './ReactExample';

type TutorialTrialProps = Omit<Parameters<typeof ReactExample>[0], 'parameters'> & {
  parameters: {
    dataset: 'cars' | 'penguin';
    brushType: 'Rectangular Selection' | 'Slider Selection';
  };
};

const datasetAxes = {
  cars: { x: 'Miles per Gallon', y: 'Weight (lbs)', category: 'Origin' },
  penguin: { x: 'Body Mass (g)', y: 'Flipper Length (mm)', category: 'Species' },
};

export default function TutorialFactorTrial({ parameters, ...props }: TutorialTrialProps) {
  return (
    <ReactExample
      {...props}
      parameters={{ ...parameters, ...datasetAxes[parameters.dataset], ids: 'id' }}
    />
  );
}
