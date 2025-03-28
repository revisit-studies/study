import React, { useState, useEffect } from 'react';
import { Button, Radio, Select, Slider } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import { SettingOutlined } from '@ant-design/icons';
import {
  setEncoding,
  setIsSnr,
  setColorScale,
  setNMeans,
  setNStds,
  setTooltip,
  setShowTooltip,
} from '../../features/matrix/matrixSlice';
import { setFile } from '../../features/data/dataSlice';

const Menu = ({ items }) => {
  return (
    <div className="absolute-top-right">
      <div> This will not be available in the study → </div>
      <MenuButton items={items} />{' '}
    </div>
  );
};

const MenuButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div>
      <Button type="primary" onClick={() => setIsVisible(!isVisible)}>
        <SettingOutlined />
      </Button>

      {isVisible && (
        <div className="absolute-panel">
          {/* <TrrackButtons></TrrackButtons> */}
          <FileSelector></FileSelector>
          <NMeansSlider></NMeansSlider>
          <NStdSlider></NStdSlider>

          <ShowTooltipRadio></ShowTooltipRadio>
          <TooltipRadio></TooltipRadio>

          <SnrRadio></SnrRadio>
          <EncodingRadio></EncodingRadio>
          <ColorScaleRadio></ColorScaleRadio>
        </div>
      )}
    </div>
  );
};

export default Menu;

const SnrRadio = () => {
  const dispatch = useDispatch();

  const isSnr = useSelector((state) => state.matrix.parameters.isSnr);

  const handleChange = (e) => {
    dispatch(setIsSnr(e.target.value));
  };

  return (
    <div>
      <div>Deviation as:</div>
      <Radio.Group onChange={handleChange} value={isSnr ? 'snr' : 'std'}>
        <Radio value="snr">Signal-to-noise</Radio>
        <Radio value="std">Absolute std</Radio>
      </Radio.Group>
    </div>
  );
};

const ShowTooltipRadio = () => {
  const dispatch = useDispatch();

  const showTooltip = useSelector((state) => state.matrix.parameters.showTooltip);

  const handleChange = (e) => {
    dispatch(setShowTooltip(e.target.value));
  };

  return (
    <div>
      <div>Show Tooltip:</div>
      <Radio.Group onChange={handleChange} value={showTooltip ? 'show' : 'hide'}>
        <Radio value="show">Show tooltip</Radio>
        <Radio value="hide">Hide tooltip</Radio>
      </Radio.Group>
    </div>
  );
};

const EncodingRadio = () => {
  const dispatch = useDispatch();

  const encoding = useSelector((state) => state.matrix.parameters.encoding);

  const handleChange = (e) => {
    dispatch(setEncoding(e.target.value));
  };

  return (
    <div>
      <div>Encodings:</div>
      <Radio.Group style={{ display: 'flex', flexDirection: 'column' }} onChange={handleChange} value={encoding}>
        <Radio value="simple">Mean</Radio>
        <Radio value="squareMark">Square Mark</Radio>
        <Radio value="rotationMark">Rotation Mark</Radio>
        <Radio value="cellSize">Cell Size</Radio>
        <Radio value="lightness">Lightness</Radio>
        <Radio value="bars">Bars</Radio>
      </Radio.Group>
    </div>
  );
};

const ColorScaleRadio = () => {
  const dispatch = useDispatch();

  const colorScale = useSelector((state) => state.matrix.parameters.colorScale);

  const handleChange = (e) => {
    dispatch(setColorScale(e.target.value));
  };

  return (
    <div>
      <div>Color Scales:</div>
      <Radio.Group style={{ display: 'flex', flexDirection: 'column' }} onChange={handleChange} value={colorScale}>
        <Radio value="blues">Blues</Radio>
        <Radio value="oranges">Oranges</Radio>
        <Radio value="reds">Reds</Radio>

        <Radio value="viridis">Viridis</Radio>
        <Radio value="cividis">Cividis</Radio>

        <Radio value="cool">Cool</Radio>
        <Radio value="warm">Warm</Radio>

        <Radio value="plasma">Plasma</Radio>
        <Radio value="inferno">Inferno</Radio>

        <Radio value="turbo">Turbo</Radio>
      </Radio.Group>
    </div>
  );
};

const TooltipRadio = () => {
  const dispatch = useDispatch();

  const value = useSelector((state) => state.matrix.parameters.tooltipHistogram);
  const showTooltip = useSelector((state) => state.matrix.parameters.showTooltip);

  const handleChange = (e) => {
    dispatch(setTooltip(e.target.value));
  };

  return (
    <div style={{ display: showTooltip ? 'block' : 'none' }}>
      <div>Tooltip Histogram:</div>
      <Radio.Group onChange={handleChange} value={value}>
        <Radio value="prices">Price Distribution</Radio>
        <Radio value="frequencies">Week Frequency by Airline</Radio>
      </Radio.Group>
    </div>
  );
};

const FileSelector = () => {
  const dispatch = useDispatch();
  const files = useSelector((state) => state.data.files);
  const file = useSelector((state) => state.data.file);

  const onChange = (value) => {
    dispatch(setFile(value));
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <strong>Select Network:</strong>
      <Select style={{ width: '100%' }} value={file} placeholder="Select a network file" onChange={onChange}>
        {files.map((filePath, index) => (
          <Select.Option key={index} value={filePath}></Select.Option>
        ))}
      </Select>
    </div>
  );
};

const NMeansSlider = () => {
  const dispatch = useDispatch();
  const n = useSelector((state) => state.matrix.parameters.nMeans);
  const encoding = useSelector((state) => state.matrix.parameters.encoding);

  const onSliderComplete = (value) => {
    dispatch(setNMeans(value));
  };

  return (
    <div>
      <div>N Mean Categories:</div>
      <Slider min={3} max={7} defaultValue={n} onChangeComplete={onSliderComplete} step={1} style={{ width: '100%' }} />
    </div>
  );
};

const NStdSlider = () => {
  const dispatch = useDispatch();
  const n = useSelector((state) => state.matrix.parameters.nStds);

  const onSliderComplete = (value) => {
    dispatch(setNStds(value));
  };

  return (
    <div>
      <div>N Deviation Categories:</div>
      <Slider min={2} max={7} defaultValue={n} onChangeComplete={onSliderComplete} step={1} style={{ width: '100%' }} />
    </div>
  );
};

/* const TrrackButtons = () => {
  const dispatch = useDispatch();
  const n = useSelector((state) => state.matrix.nStds);

  const undo = () => {
    trrack.undo();
  };

  const redo = () => {
    trrack.redo();
  };

  return (
    <div>
      <div>Trrack!</div>
      <Button type="primary" onClick={undo}>
        Undo
      </Button>
      <Button type="primary" onClick={redo}>
        Redo
      </Button>
    </div>
  );
}; */
