import numpy as np
import random

from common.utils import perlin_noise, rescale_to_mean, add_smooth_peak, clip_0_100
from common.constants import (
    MONTHS,
    DAYS_PER_MONTH,
    WINNING_MEAN_RANGE,
    DISTRACTER_GAP_RANGE,
    DISTRACTER_COUNT_RANGE,
    DEFAULT_NOISE_LEVEL,
    NOISE_MAP,
    NOISE_LEVELS,
    DISTRACTER_COUNTS,
    DISTRACTER_GAPS,
    MONTH_NAMES,
    MIN_MEAN
)
from itertools import product

def generate_series(
    days_per_month=DAYS_PER_MONTH,
    months=MONTHS,
    k=None,
    d=None,
    winning_month=None,
    noise_level=DEFAULT_NOISE_LEVEL,
    smooth_noise_function=perlin_noise,
    seed=None
):
    """
    Parameters:
        k: number of distracter months
        d: gap between winning and distracter months
        winning_month: int [0,11], if None randomly chosen
        noise_level: int in NOISE_LEVELS
        smooth_noise_function: function to generate structured noise
        seed: random seed for reproducibility

    Generates synthetic time series matching the paper's method:

    https://dl.acm.org/doi/abs/10.1145/2207676.2208556

    1) one continuous yearly structured-noise curve
    2) split into months
    3) shift each month to target mean
    4) add smooth peaks
    5) renormalize + clip

    Returns:
        series: (months * days_per_month,) array
        winning_month: int
        distracter_months: list[int]
        month_means: list[float]
    """

    if seed is not None:
        np.random.seed(seed)
        random.seed(seed)

    total_days = days_per_month * months

    # Sample parameters
    uw = np.random.uniform(*WINNING_MEAN_RANGE)

    if k is None:
        k = random.randint(*DISTRACTER_COUNT_RANGE)

    if d is None:
        d = random.randint(*DISTRACTER_GAP_RANGE)

    noise_params = NOISE_MAP[noise_level]

    # Sample winning month
    if winning_month is None:
        winning_month = random.randrange(months)

    month_means = [0] * months
    month_means[winning_month] = uw

    all_months = list(range(months))
    all_months.remove(winning_month)

    # Sample distracter months
    distracter_months = random.sample(all_months, k)

    for m in distracter_months:
        month_means[m] = uw - d

    for m in range(months):
        if month_means[m] == 0:
            month_means[m] = np.random.uniform(MIN_MEAN, uw - d - 1)

    # Generate yearly structured noise and split into months
    yearly_base = smooth_noise_function(total_days, **noise_params)

    months_data = []

    for m in range(months):
        start = m * days_per_month
        end = start + days_per_month

        month_signal = yearly_base[start:end].copy()

        # Shift to target mean
        month_signal = rescale_to_mean(month_signal, month_means[m])

        # Add smooth peaks (repeat twice as in paper)
        for _ in range(2):
            month_signal = add_smooth_peak(month_signal)

        # Rescale to target mean again
        month_signal = rescale_to_mean(month_signal, month_means[m])

        month_signal = clip_0_100(month_signal)

        months_data.append(month_signal)

    series = np.concatenate(months_data)

    return series, winning_month, distracter_months, month_means


def generate_all_series(fixed_noise_level=None):
    """
    12 winning months x 3 k x 10 d x 3 noise levels = 1080 series
    If fixed_noise_level is set, then 360 series.
    """
    all_data = []

    if fixed_noise_level is not None:
        noise_levels = [fixed_noise_level]
    else:
        noise_levels = NOISE_LEVELS

    for win, k, d, noise in product(range(MONTHS), DISTRACTER_COUNTS, DISTRACTER_GAPS, noise_levels):
        s, _, _, _ = generate_series(k=k, d=d, noise_level=noise, winning_month=win)
        all_data.append((s, win, k, d, noise))

    return all_data


if __name__ == "__main__":
    s, win, dist, means = generate_series(
        k=4,
        d=2,
        noise_level=2,
        winning_month=7,
        seed=1
    )

    print("Winning month:", MONTH_NAMES[win])

    from common.plotting import plot_line, plot_colorfield

    plot_line(s, permuted=False, title="Original Series")
    # plot_line(s, permuted=True, title="Permuted Series")
    # plot_colorfield(s, permuted=False, title="Original Colorfield")
    # plot_colorfield(s, permuted=True, title="Permuted Colorfield")