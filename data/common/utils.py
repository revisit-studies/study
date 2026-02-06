import numpy as np
from scipy.ndimage import gaussian_filter1d
from common.constants import MONTHS, DAYS_PER_MONTH
from noise import pnoise1

def perlin_noise(length, scale=0.1, amp=10, octaves=3):
    """Generate 1D Perlin noise."""
    xs = np.linspace(0, length * scale, length)
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