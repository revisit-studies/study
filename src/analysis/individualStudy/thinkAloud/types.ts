export interface TranscribedAudioSnippet {
    alternatives: {confidence: number, transcript: string}[]
    languageCode: string;
    resultEndTime: string | number;
}

export interface TranscribedAudio {
    results: TranscribedAudioSnippet[]
}

export interface Tag {
    color: string,
    name: string,
    id: string
}

export interface ParticipantTags {
    partTags: Tag[],
    taskTags: Record<string, Tag[]>
}

export interface StoredParticipantTags {
    partTags: string[],
    taskTags: Record<string, string[]>
}

export interface EditedText {
    transcriptMappingStart: number;
    transcriptMappingEnd: number;
    text: string;
    selectedTags: Tag[];
    annotation: string;
}

export interface TranscriptLinesWithTimes {
    start: number,
    end: number,
    lineStart: number,
    lineEnd: number,
    tags: Tag[][]
}
