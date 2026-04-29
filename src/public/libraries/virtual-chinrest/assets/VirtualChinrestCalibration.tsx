/* eslint-disable react/no-unescaped-entities */
import { useState, useRef, useEffect } from 'react';
import {
  Slider, Button, Stack, Text,
} from '@mantine/core';
import { StimulusParams } from '../../../../store/types';
import cardImage from './card.png';

interface VirtualChinrestCalibrationProps extends StimulusParams<{ taskid: string }> {
  itemWidthMM: number;
  itemHeightMM: number;
  fixedCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// --- utility functions
// Calculate height based on width and aspect ratio
const calculateHeight = (width: number, aspectRatio:number) => Math.round(width * aspectRatio);

export default function VirtualChinrestCalibration({
  parameters,
  setAnswer,
  itemWidthMM = 85.6, // Standard credit card width
  itemHeightMM = 53.98, // Standard credit card height
  fixedCorner = 'top-left', // Default to top-left fixed corner
}: VirtualChinrestCalibrationProps) {
  // Set states
  const [itemWidthPx, setItemWidthPx] = useState(300); // default starting slider value (unit is px)
  const [isCalibrationComplete, setIsCalibrationComplete] = useState(false);
  const [sliderRange, setSliderRange] = useState({ min: 100, max: 500 });
  const [hasMovedSlider, setHasMovedSlider] = useState(false);
  const [showMoveSliderWarning, setShowMoveSliderWarning] = useState(false);

  const { taskid } = parameters;
  const pixelsPerMM = itemWidthPx / itemWidthMM; // pixel to MM conversion

  // Set references
  const containerRef = useRef<HTMLDivElement>(null);

  // Aspect ratio of the item
  const aspectRatio = itemHeightMM / itemWidthMM;

  useEffect(() => {
    const updateSliderRange = () => {
      const screenWidth = window.innerWidth;
      setSliderRange({
        min: Math.round(screenWidth * 0.1), // 10% of screen width
        max: Math.round(screenWidth * 0.8), // 80% of screen width
      });
    };

    updateSliderRange();
    window.addEventListener('resize', updateSliderRange);
    return () => window.removeEventListener('resize', updateSliderRange);
  }, []);

  // Handle a change in the slider
  const handleSliderChange = (value: number) => {
    setItemWidthPx(value);
    setHasMovedSlider(true);
    setShowMoveSliderWarning(false);
  };

  const handleCalibrationComplete = () => {
    if (!containerRef.current) return;
    if (!hasMovedSlider) {
      setShowMoveSliderWarning(true);
      return;
    }

    // Prepare answer for the study framework
    setAnswer({
      status: true,
      answers: {
        [taskid]: pixelsPerMM,
      },
    });

    setIsCalibrationComplete(true);
  };

  // Get position styles based on which corner should be fixed
  const getPositionStyles = () => ({
    position: 'relative' as const,
    width: '100%',
    display: 'flex',
    justifyContent: fixedCorner.includes('right') ? 'flex-end' : 'flex-start',
    alignItems: fixedCorner.includes('bottom') ? 'flex-end' : 'flex-start',
  });

  return (
  // Container component from Mantine that centers content and provides max-width
    <Stack gap="lg">
      <Text size="md"> Drag the slider until the image is the same size as a credit card held up to the screen.</Text>
      <Text size="md"> You can use any card that is the same size as a credit card, like a membership card or driver's license.</Text>
      <Text size="md"> If you do not have access to a real card, you can use a ruler to measure the image width to 3.37 inches or 85.6mm. </Text>
      <Text size="md"> Once you are finished, click "Confirm Size" and then "Next". </Text>
      <Slider
        min={sliderRange.min}
        max={sliderRange.max}
        value={itemWidthPx}
        label={null}
        onChange={handleSliderChange}
        styles={{
          root: { width: '100%' }, // Makes slider full width
          track: { cursor: 'pointer' }, // Changes cursor on track
          thumb: { cursor: 'grab' }, // Changes cursor on thumb
          bar: { cursor: 'pointer' }, // Changes cursor on filled bar
        }}
      />

      {/* Wrapper div that maintains position */}
      <div style={getPositionStyles()}>
        {/* Card container that changes size */}
        <div
          ref={containerRef}
          style={{
            width: `${itemWidthPx}px`,
            height: `${calculateHeight(itemWidthPx, aspectRatio)}px`,
            overflow: 'hidden', // Prevents image overflow
          }}
        >
          <img
            src={cardImage}
            alt="Credit Card"
            style={{
              width: '100%', // Makes image fill container
              height: '100%',
              objectFit: 'contain', // Maintains aspect ratio
            }}
          />
        </div>
      </div>

      {isCalibrationComplete && (
      <div style={{ textAlign: 'center', color: 'green' }}>
        Calibration Complete - Pixels per MM:
        {' '}
        {pixelsPerMM?.toFixed(2)}
      </div>
      )}
      {/* Text warning for moving the slider */}
      {
        showMoveSliderWarning && (
          <Text c="red" size="md" fw={500}>
            Please move the slider to calibrate before confirming.
          </Text>
        )
      }
      <Button
        onClick={handleCalibrationComplete}
        size="lg"
        variant="transparent"
      >
        Confirm Size
      </Button>
    </Stack>
  );
}
