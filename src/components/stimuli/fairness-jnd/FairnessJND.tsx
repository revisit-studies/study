import { useLocation } from 'react-router-dom';
import { StimulusParams } from '../../../store/types';
import RankingCombinations from './ranking-combinations.json';
import { useMemo } from 'react';
import { Button, Grid } from '@mantine/core';

const CombinationsByArp: { [arp: string]: number[][] } = (
  RankingCombinations as { arp: number; rankings: number[] }[]
).reduce((a, v) => ({ ...a, [v.arp.toString()]: v.rankings }), {});

const Ranking = ({ rankings }: { rankings: number[] }) => {
  return (
    <div>
      <div>
        {rankings.map((item, idx) => {
          return (
            <div
              key={idx}
              style={{
                textAlign: 'center',
                marginBottom: 2,
                padding: 2,
                background: `${item === 0 ? '#AEC7E8' : '#FF9896'}`,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FairnessJND = ({ parameters, trialId, setAnswer }: StimulusParams) => {
  const id = useLocation().pathname;

  const [r1, r2] = useMemo(() => {
    if (Math.floor(Math.random() * 2) === 0) {
      return [
        {
          arp: parameters.data.r1,
          ranking:
            CombinationsByArp[parameters.data.r1][
              Math.floor(
                Math.random() * CombinationsByArp[parameters.data.r1].length
              )
            ],
        },
        {
          arp: parameters.data.r2,
          ranking:
            CombinationsByArp[parameters.data.r2][
              Math.floor(
                Math.random() * CombinationsByArp[parameters.data.r2].length
              )
            ],
        },
      ];
    } else {
      return [
        {
          arp: parameters.data.r2,
          ranking:
            CombinationsByArp[parameters.data.r2][
              Math.floor(
                Math.random() * CombinationsByArp[parameters.data.r2].length
              )
            ],
        },
        {
          arp: parameters.data.r1,
          ranking:
            CombinationsByArp[parameters.data.r1][
              Math.floor(
                Math.random() * CombinationsByArp[parameters.data.r1].length
              )
            ],
        },
      ];
    }
  }, [parameters]);

  const updateAnswer = (arp: number) => {
    setAnswer({
      trialId: id,
      status: true,
      answers: {
        [`${id}/${parameters.taskid}`]: [arp],
      },
    });
  };

  return (
    <div>
      <Grid>
        <Grid.Col span={2}>
          <Ranking rankings={r1.ranking} />
          <Button
            onClick={() => {
              updateAnswer(r1.arp);
            }}
          >
            Select
          </Button>
        </Grid.Col>
        <Grid.Col span={2}>
          <Ranking rankings={r2.ranking} />
          <Button
            onClick={() => {
              updateAnswer(r2.arp);
            }}
          >
            Select
          </Button>
        </Grid.Col>
      </Grid>
    </div>
  );
};

export default FairnessJND;
