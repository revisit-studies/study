import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.interpolate import CubicSpline
from common.constants import MONTHS, DAYS_PER_MONTH
from noise import pnoise1

def perlin_noise(length, scale=0.1, amp=10, octaves=3):
    """Generate 1D Perlin noise."""
    # Start at random offset to get different noise patterns and avoid pinning to 0 at ends
    start = np.random.uniform(0, 10000)
    xs = np.linspace(start, start + length * scale, length)
    y = np.array([pnoise1(x, octaves=octaves) for x in xs])

    y -= y.mean()
    y /= (np.std(y) + 1e-8)

    return amp * y


def smooth_noise(length, scale=5, amp=1.0):
    """Create smooth structured noise using Gaussian filtering."""
    x = np.random.randn(length)
    x = gaussian_filter1d(x, sigma=scale)
    x -= x.mean()
    x /= (np.std(x) + 1e-8)
    return amp * x


def rescale_to_mean(arr, target_mean):
    """Shift values to match a desired mean."""
    return arr - arr.mean() + target_mean


def clip_0_100(arr):
    return np.clip(arr, 0, 100)


def add_smooth_peak(signal, width=5, height=15):
    """Add a smooth Gaussian peak to a 1D signal."""
    center = np.random.randint(len(signal))
    xs = np.arange(len(signal))
    bump = height * np.exp(-((xs - center)**2) / (2 * width**2))
    return signal + bump


def permute_line(series, days_per_month=DAYS_PER_MONTH):
    """1D horizontal shuffle within each month"""
    out = []
    for m in range(MONTHS):
        block = series[m*days_per_month:(m+1)*days_per_month].copy()
        np.random.shuffle(block)
        out.append(block)
    return np.concatenate(out)


def permute_colorfield(matrix):
    """2D shuffle pixels within each month"""
    h, w = matrix.shape
    month_w = w // MONTHS
    new = matrix.copy()

    for m in range(MONTHS):
        block = new[:, m*month_w:(m+1)*month_w]
        flat = block.flatten()
        np.random.shuffle(flat)
        new[:, m*month_w:(m+1)*month_w] = flat.reshape(block.shape)

    return new


def distribute_monthly_peaks(series, days_per_month, peaks_per_month=2, height=15, width=5):
    """Adds random smooth peaks to each month segment of the series in-place."""
    months = len(series) // days_per_month
    xs = np.arange(len(series))
    
    for m in range(months):
        start = m * days_per_month
        end = start + days_per_month
        
        for _ in range(peaks_per_month):
            center = np.random.randint(start, end)
            bump = height * np.exp(-((xs - center)**2) / (2 * width**2))
            series += bump
    return series


def apply_trend_correction(series, target_means, days_per_month, iterations=5):
    """
    Adds a smooth cubic spline trend to the series so strict monthly means are matched.
    Returns the corrected series.
    """
    months = len(target_means)
    xs = np.arange(len(series))
    
    # Calculate current means
    current_means = []
    for m in range(months):
        start = m * days_per_month
        end = start + days_per_month
        current_means.append(np.mean(series[start:end]))
        
    diffs = np.array(target_means) - np.array(current_means)
    
    # Control points at month centers
    month_centers = np.arange(months) * days_per_month + (days_per_month / 2)
    control_points = np.copy(diffs)
    
    # Iterative refinement
    for _ in range(iterations):
        # AI Usage Note: One thing I'm noticing is that December always seems to end at 0
        # use bc_type='clamped' to ensure 0 slope at ends, preventing the signal from 
        # diving/skyrocketing at the boundaries (which often causes the end to be the min/max)
        spline = CubicSpline(month_centers, control_points, bc_type='clamped')
        trend_curve = spline(xs)
        
        curve_means = []
        for m in range(months):
            start = m * days_per_month
            end = start + days_per_month
            curve_means.append(np.mean(trend_curve[start:end]))
            
        error = diffs - np.array(curve_means)
        control_points += error

    final_spline = CubicSpline(month_centers, control_points, bc_type='clamped')
    series += final_spline(xs)
    return series


def safe_rescale(series, days_per_month, min_val=0, max_val=100):
    """
    Rescales the series to fit within [min_val, max_val] if out of bounds.
    Recalculates and returns the new monthly means if rescaling occurred.
    Otherwise clips and returns None for new_means.
    """
    s_min = np.min(series)
    s_max = np.max(series)
    
    new_means = None
    
    if s_min < min_val or s_max > max_val:
        if s_max > s_min:
            series = (series - s_min) / (s_max - s_min) * (max_val - min_val) + min_val
        else:
            series = np.clip(series, min_val, max_val)
            
        # Recalculate means
        months = len(series) // days_per_month
        new_means = []
        for m in range(months):
             start = m * days_per_month
             end = start + days_per_month
             new_means.append(np.mean(series[start:end]))
    else:
        series = np.clip(series, min_val, max_val)

    return series, new_means