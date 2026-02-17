
import numpy as np
import sys
import os

# AI Usage Note: Can you add a testing script next to generate_data that can take the series output and confirm that the winning month is correct based on the signal?

# Ensure we can import from the data directory
sys.path.append(os.getcwd())

from scripts.generate_data import generate_series, generate_all_series
from common.constants import DAYS_PER_MONTH, MONTHS, MONTH_NAMES

def calculate_monthly_stats(series, days_per_month=DAYS_PER_MONTH):
    """Calculates the mean of each month in the series."""
    means = []
    for m in range(MONTHS):
        start = m * days_per_month
        end = start + days_per_month
        segment = series[start:end]
        means.append(np.mean(segment))
    return np.array(means)

def run_tests():
    print("Generating comprehensive dataset (this may take a moment)...")
    all_data = generate_all_series()
    total_tests = len(all_data)
    
    failures = 0
    print(f"Running validation on {total_tests} series covering all parameter combinations...")
    
    # generate_all_series returns list of (series, win, k, d, noise_level)
    for i, (series, expected_win_idx, k, d, noise) in enumerate(all_data):
        
        # Calculate actual means from the signal
        actual_means = calculate_monthly_stats(series)
        
        # Determine the winner index from the signal
        observed_win_idx = np.argmax(actual_means)
        
        if observed_win_idx != expected_win_idx:
            failures += 1
            print(f"FAIL [Index {i}]: Params(Win={MONTH_NAMES[expected_win_idx]}, k={k}, d={d}, noise={noise})")
            print(f"  Expected {MONTH_NAMES[expected_win_idx]} to win.")
            print(f"  Got {MONTH_NAMES[observed_win_idx]} ({actual_means[observed_win_idx]:.2f}) vs Expected ({actual_means[expected_win_idx]:.2f})")
        
    print(f"\nResults: {total_tests - failures}/{total_tests} passed.")
    if failures == 0:
        print("✅ All series consistently identified the correct winning month.")
    else:
        print("❌ valid series generation failed in some cases.")

if __name__ == "__main__":
    run_tests()
