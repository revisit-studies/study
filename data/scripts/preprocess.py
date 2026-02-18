import pandas as pd
from pathlib import Path

# Assumes that we are running this script from the data folder
TIDY_CSV_PATH = Path("csvs/tidy.csv")
CLEAN_CSV_PATH = Path("csvs/clean.csv")

def preprocess_tidy_csv(input_csv_path: Path, output_csv_path: Path) -> None:
    """
    Reads the tidy CSV file from the reVISit website, reads the relevant data for analysis, and exports
    it as a new CSV file for use in the analysis notebook.

    AI Usage Note: We want one row for each trial for every participant. That should include the chart type (line or colorfield), the permutation (ordered or permuted), a binary for if it is correct, and the response time if we have it. 

    Parameters:
        input_csv_path (Path): The path to the input tidy CSV file.
        output_csv_path (Path): The path where the processed CSV file will be saved.
    """

    df = pd.read_csv(input_csv_path)

    # Only keep rows that are actual trials (responseId == 'cm-response')
    trial_df = df[df['responseId'] == 'cm-response'].copy()

    # Count number of trials per participant
    trial_counts = trial_df.groupby('participantId').size()
    valid_participants = trial_counts[trial_counts == 40].index

    # Filter to only valid participants
    trial_df = trial_df[trial_df['participantId'].isin(valid_participants)]

    # Extract chartType and permuted from meta field (JSON)
    import json
    def extract_meta(row):
        try:
            meta = row['meta']
            if pd.isnull(meta) or meta == 'undefined':
                return {'chartType': None, 'permuted': None}
            meta_dict = json.loads(meta)
            chart_type = meta_dict.get('chart')
            permuted = meta_dict.get('permuted')
            return {'chartType': chart_type, 'permuted': 'permuted' if permuted else 'ordered'}
        except Exception:
            return {'chartType': None, 'permuted': None}

    meta_extracted = trial_df.apply(extract_meta, axis=1, result_type='expand')
    trial_df['chartType'] = meta_extracted['chartType']
    trial_df['permuted'] = meta_extracted['permuted']
    trial_df['isCorrect'] = trial_df['answer'] == trial_df['correctAnswer']

    # Clean up response time (prefer cleanedDuration if available, else duration)
    def get_response_time(row):
        if pd.notnull(row['cleanedDuration']) and row['cleanedDuration'] != 'undefined':
            return float(row['cleanedDuration'])
        elif pd.notnull(row['duration']) and row['duration'] != 'undefined':
            return float(row['duration'])
        else:
            return None

    trial_df['responseTime'] = trial_df.apply(get_response_time, axis=1)

    # Select and rename columns for output (snake_case, response_time_ms)
    out_df = trial_df[['participantId', 'trialId', 'chartType', 'permuted', 'isCorrect', 'responseTime']].copy()
    out_df = out_df.rename(columns={
        'participantId': 'participant_id',
        'trialId': 'trial_id',
        'chartType': 'chart_type',
        'permuted': 'permuted',
        'isCorrect': 'is_correct',
        'responseTime': 'response_time_ms',
    })

    # Save to CSV
    out_df.to_csv(output_csv_path, index=False)

def sample_analysis():
    """
    A sample analysis function to demonstrate how to read the cleaned CSV and perform basic analysis.
    This is not meant to be comprehensive, but just a starting point for the analysis notebook.
    """
    df = pd.read_csv(CLEAN_CSV_PATH)

    # Number of participants
    print(f"\nNumber of Participants: {df['participant_id'].nunique()}")

    # Accuracy by chart type
    accuracy_by_chart = df.groupby('chart_type')['is_correct'].mean()
    print("\nAccuracy by Chart Type:")
    print(accuracy_by_chart)

    # Response time by chart type
    response_time_by_chart = df.groupby('chart_type')['response_time_ms'].mean()
    print("\nAverage Response Time by Chart Type (ms):")
    print(response_time_by_chart)

if __name__ == "__main__":
    preprocess_tidy_csv(TIDY_CSV_PATH, CLEAN_CSV_PATH)
    print(f"Preprocessed data saved to {CLEAN_CSV_PATH}")

    sample_analysis()