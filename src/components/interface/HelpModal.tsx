import { Modal, Image } from '@mantine/core';
import { toggleShowHelpText, useFlagsDispatch, useFlagsSelector } from '../../store/flags';
import ReactMarkdown from 'react-markdown';
import { useAppSelector } from '../../store';
import { useEffect, useState } from 'react';
import { PREFIX } from '../../App';


export default function HelpModal() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showHelpText = useFlagsSelector((state: any) => state.showHelpText);
  const config = useAppSelector((state) => state.study.config);

  const flagsDispatch = useFlagsDispatch();

  const [helpText, setHelpText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  useEffect(() => {
    if (!config) return;
    if (!(config.uiConfig.helpTextPath || config.uiConfig.helpImgPath)) return;

    if (config.uiConfig.helpTextPath){
      fetch(`${PREFIX}${config.uiConfig.helpTextPath}`)
          .then((response) => response.text())
          .then((text) => setHelpText(text));
    }

    if(config.uiConfig.helpImgPath){
      fetch(`${PREFIX}${config.uiConfig.helpImgPath}`)
          .then((response) => response.blob())
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            setImageUrl(url);
          });
    }

  }, [config]);

  return (
    <Modal size={'auto'} opened={showHelpText} onClose={() => flagsDispatch(toggleShowHelpText())} title="Help">
      <ReactMarkdown>{helpText}</ReactMarkdown>
      {imageUrl&&<Image maw={600} mx="auto" src={imageUrl} alt="Image" />}
    </Modal>
  );
}