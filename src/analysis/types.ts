import {
  GlobalConfig, IndividualComponent, InheritedComponent, StudyConfig,
} from '../parser/types';
import { ParticipantData } from '../storage/types';
import { StoredAnswer } from '../store/types';

export interface DashBoardProps {
    globalConfig: GlobalConfig;
}

export interface SummaryBlockProps {
    databaseSection: string;
    globalConfig: GlobalConfig;
}

export interface HeaderProps {
    studyIds: string[];
}
export interface SummaryPanelProps {
    studyId: string;
    data: ParticipantData[];
}

export interface LineChartData {
    time: number ;
    value: number;
}

export interface timeAxisProps {
    domain: Date[];
    range: number[];
}

export interface StatsVisAreaProps{
    data: ParticipantData[];
    config: StudyConfig;
}

export interface InfoPanelProps {
    data: Record<string, StoredAnswer>;
    trialName: string;
    config: IndividualComponent | InheritedComponent | undefined;
}

export interface BasicStats {
    min: number;
    max: number;
    mean: number;
    mid: number;
    maxUser: string;
    minUser: string;
}

export interface MeanVisProps {
    stats: BasicStats;
    trialName: string;
}

export interface CorrectVisProps {
    correct: string[];
    incorrect: string[];
    trialName: string;
}

export interface StatsVisProps {
    name: string,
    value: number;
}

export interface CategoricalVisProps {
    data: StatsVisProps[];
    trialName: string;
    correctValue: string;
}

export interface NumericalVisProps {
    data: number[];
    trialName: string;
    correctValue: number;
    min: number;
    max: number;
}

export interface AnswerPanelProps {
    data: Record<string, Record<string, unknown>>;
    trialName: string;
    config: IndividualComponent | InheritedComponent | undefined;
}

export interface AnswerSubPanelBaseProps {
    correctUser: string[];
    incorrectUser: string[];
    trialName: string;
    type: string
    qid:string;
    prompt:string;
}

export interface AnswerSubPanelProps extends AnswerSubPanelBaseProps {
    stats: StatsVisProps[];
    correctValue: string;
}

export interface AnswerSubPanelNumericalProps extends AnswerSubPanelBaseProps{
    max?: number;
    min?: number;
    data: number[];
    correctValue: number;
}

export interface AnswerSubPanelTextProps extends AnswerSubPanelBaseProps{
    textAnswers: Map<string, string>;
    correctValue: string;
}
