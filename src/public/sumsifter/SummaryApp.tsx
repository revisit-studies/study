import { useEffect, useState } from 'react';
import { Grid } from '@mantine/core';
import * as d3 from 'd3';
import Summary from './Summary';
import { StimulusParams } from '../../store/types';
import { SumParams } from './types';
import Source from './Source';

function SummaryApp({ parameters }: StimulusParams<SumParams>) {
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  const [summaryData, setSummaryData] = useState<{ id: number; text: string; sources: string[] }[]>([]);

  const [sourcesData, setSourcesData] = useState<{ id: string; text: string }[]>([]);

  // // load data
  useEffect(() => {
    d3.csv(`./data/${parameters.datasetSummary}.csv`).then((_data) => {
      const convertedData = _data.map((row) => ({
        id: Number(row.id),
        text: row.text ?? '', // Provide a default empty string if row.text is undefined
        sources: (row.sources ?? '').split(',').map((s) => s.trim()), // Split sources into an array
      }));
      setSummaryData(convertedData);
    });
  }, [parameters]);

  useEffect(() => {
    d3.csv(`./data/${parameters.datasetSource}.csv`).then((_data) => {
      const convertedData = _data.map((row) => ({
        id: String(row.id), // Convert the id to a string
        text: row.text ?? '', // Provide a default empty string if row.text is undefined
        sources: (row.sources ?? '').split(',').map((s) => s.trim()), // Split sources into an array
      }));
      setSourcesData(convertedData);
    });
  }, [parameters]);

  useEffect(() => {
    // make API calls here and set summary and sources data

    // TODO: API Call

    // Set Summary and Sources data
    // setSummaryData([
    //   { id: 1, text: 'The SCADS 2024 Grand Challenge focuses on creating Tailored Daily Reports (TLDRs) for knowledge workers in the Intelligence Community.', sources: ['S5', 'S7'] },
    //   { id: 2, text: 'TLDRs aim to combine classified and unclassified materials in various formats, tailored to individual interests and responsibilities.', sources: ['S7', 'S9'] },
    //   { id: 3, text: 'The project involves automatic summarization using both extractive and abstractive methods.', sources: ['S12', 'S14'] },
    //   { id: 4, text: 'Retrieval-Augmented Generation (RAG) enhances multi-document summarization and minimizes hallucinations.', sources: ['S18', 'S20'] },
    //   { id: 5, text: 'Temporal elements ensure summaries are up-to-date.', sources: ['S25', 'S27'] },
    //   { id: 6, text: 'Recommendation systems will personalize content based on user feedback and mitigate bias.', sources: ['S32', 'S35'] },
    //   { id: 7, text: 'These systems will leverage Large Language Models (LLMs), knowledge graphs (KGs), and multi-modal data.', sources: ['S37', 'S40'] },
    //   { id: 8, text: 'Ensuring explainability and transparency is crucial for user trust and effective use.', sources: ['S45', 'S47'] },
    //   { id: 9, text: 'Human-Computer Interaction (HCI) research will model the analytic ecosystem to understand workflows and information needs.', sources: ['S50', 'S52'] },
    //   { id: 10, text: 'Personalization of TLDR presentations will be based on analytic workflows, cognitive load, and other factors.', sources: ['S57', 'S59'] },
    // ]);

    // setSourcesData([
    //   { id: 'S5', text: 'Grand Challenge is to create TLDRs for knowledge workers.' },
    //   { id: 'S7', text: 'TLDRs are similar to the President\'s Daily Brief, combining classified and unclassified materials.' },
    //   { id: 'S9', text: 'They include information from various modes and formats tailored to individual interests.' },
    //   { id: 'S12', text: 'Automatic summarization involves extractive and abstractive methods.' },
    //   { id: 'S14', text: 'Research in multi-modal summarization techniques is encouraged.' },
    //   { id: 'S18', text: 'Retrieval-Augmented Generation (RAG) helps in minimizing hallucinations.' },
    //   { id: 'S20', text: 'RAG incorporates external data stores to generate responses.' },
    //   { id: 'S25', text: 'Summarization must be able to adapt to fast-evolving data.' },
    //   { id: 'S27', text: 'Focusing on new information ensures up-to-date summaries.' },
    //   { id: 'S32', text: 'Personalized content recommendation involves understanding user feedback.' },
    //   { id: 'S35', text: 'Recommender models must address bias from feedback loops.' },
    //   { id: 'S37', text: 'LLMs and KGs are integrated into recommendation systems.' },
    //   { id: 'S40', text: 'Multi-modal data, including images and text, enhances recommender systems.' },
    //   { id: 'S45', text: 'Transparency in algorithms builds user trust.' },
    //   { id: 'S47', text: 'Explainability in recommender systems is essential.' },
    //   { id: 'S50', text: 'Understanding the analytic ecosystem helps in modeling workflows.' },
    //   { id: 'S52', text: 'Workflows reveal the types of information and processes analysts use.' },
    //   { id: 'S57', text: 'Personalization of TLDRs depends on various analytic workflow factors.' },
    //   { id: 'S59', text: 'Factors like cognitive load influence the presentation of TLDRs.' },
    // ]);

  }, []);

  const handleSourceClick = (sourceId: string | null) => {
    setActiveSourceId(sourceId);
  };

  return (
    <Grid>
      <Grid.Col span={6}>
        <Summary sentences={summaryData} onSourceClick={handleSourceClick} />
      </Grid.Col>
      <Grid.Col span={6}>
        <Source sourceList={sourcesData} activeSourceId={activeSourceId} />
      </Grid.Col>
    </Grid>
  );
}

export default SummaryApp;
