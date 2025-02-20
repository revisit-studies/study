import BrushPlotWrapper from './BrushPlotWrapper';

export default function ReactExample() {
  return (
    <BrushPlotWrapper
      params={{
        dataset: 'penguin',
        x: 'Body Mass (g)',
        y: 'Flipper Length (mm)',
        category: 'Species',
        ids: 'id',
        brushType: 'Slider Selection',
      }}
      answers={{}}
    />
  );
}
