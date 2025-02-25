import numpy as np
import pandas as pd
import os
from scipy.special import erfinv, erf

def generate_correlated_data_uniform(correlation, num_points, seed=None):
    """
    Generate a dataset with two variables having the specified correlation,
    with values bounded between 0 and 1.
    Parameters:
        correlation (float): Desired correlation coefficient (-1 to 1).
        num_points (int): Number of data points to generate.
        seed (int, optional): Random seed for reproducibility.
    Returns:
        np.ndarray: A 2D array of shape (num_points, 2), where each column is a variable.
    """
    if not -1 <= correlation <= 1:
        raise ValueError("Correlation must be between -1 and 1.")
    if seed is not None:
        np.random.seed(seed)
    # Generate two independent uniform random variables between 0 and 1
    x = np.random.rand(num_points)
    z = np.random.rand(num_points)
    # Apply inverse transform sampling to convert uniform to normal
    x_normal = np.sqrt(2) * erfinv(2 * x - 1)  # Inverse CDF of normal distribution
    z_normal = np.sqrt(2) * erfinv(2 * z - 1)
    # Combine them using the desired correlation
    y_normal = correlation * x_normal + np.sqrt(1 - correlation**2) * z_normal
    # Transform back to uniform distribution using normal CDF
    x_uniform = 0.5 * (1 + erf(x_normal / np.sqrt(2)))
    y_uniform = 0.5 * (1 + erf(y_normal / np.sqrt(2)))
    # Stack into a 2D array and return
    return np.column_stack((x_uniform, y_uniform))

# correlation values
correlation_values = np.round(np.arange(0.01, 1.01, 0.01), 2)
dataset_sizes = [100, 1000]  # two dataset sizes (1000 for Hexbin plots)

# directories
base_dir = "datasets"
os.makedirs(base_dir, exist_ok=True)

for size in dataset_sizes:
    size_dir = os.path.join(base_dir, f"size_{size}")
    os.makedirs(size_dir, exist_ok=True)

    for corr in correlation_values:
        dataset = generate_correlated_data_uniform(corr, size)
        filename = f"dataset_{corr}_size_{size}.csv"
        filepath = os.path.join(size_dir, filename)

        # save as CSV
        df = pd.DataFrame(dataset, columns=["X", "Y"])
        df.to_csv(filepath, index=False)

"Datasets successfully generated and saved."
