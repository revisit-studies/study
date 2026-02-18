import pandas as pd
from pathlib import Path

# Assumes that we are running this script from the data folder
TIDY_CSV_PATH = Path("csvs/tidy.csv")
CLEAN_CSV_PATH = Path("csvs/clean.csv")

def preprocess_tidy_csv(input_csv_path: Path, output_csv_path: Path) -> None:
    """
    Reads the tidy CSV file from the reVISit website, reads the relevant data for analysis, and exports
    it as a new CSV file for use in the analysis notebook.

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

    # Select and rename columns for output
    out_df = trial_df[['participantId', 'trialId', 'chartType', 'permuted', 'isCorrect', 'responseTime']].copy()

    # Save to CSV
    out_df.to_csv(output_csv_path, index=False)

if __name__ == "__main__":
    preprocess_tidy_csv(TIDY_CSV_PATH, CLEAN_CSV_PATH)
    print(f"Preprocessed data saved to {CLEAN_CSV_PATH}")