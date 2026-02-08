import numpy as np
import random
import json

from common.utils import (
    perlin_noise, 
    smooth_noise,
    rescale_to_mean, 
    add_smooth_peak, 
    clip_0_100,
    distribute_monthly_peaks,
    apply_trend_correction,
    safe_rescale
)
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
    MIN_MEAN,
    PEAKS_PER_MONTH,
    PEAK_HEIGHT,
    PEAK_WIDTH,
    SPLINE_ITERATIONS
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

    # 1. Start with a continuous base of structured noise
    # AI Usage Note: Looking at this code, can you extract any numbers into the constants file and any potential util functions into the utils file?
    series = smooth_noise_function(total_days, **noise_params)

    # 2. Add smooth peaks to each month
    # We add them to the global series to maintain continuity
    distribute_monthly_peaks(
        series, 
        days_per_month, 
        peaks_per_month=PEAKS_PER_MONTH, 
        height=PEAK_HEIGHT, 
        width=PEAK_WIDTH
    )
    
    # 3. Adjust the signal to match the target monthly means efficiently
    series = apply_trend_correction(
        series, 
        month_means, 
        days_per_month, 
        iterations=SPLINE_ITERATIONS
    )
    
    # 4. Global Rescaling if out of bounds (0-100)
    series, new_means = safe_rescale(series, days_per_month)
    
    if new_means is not None:
        month_means = new_means

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

def convertToJSON(series, winning_month, distracter_months, month_means, days_per_month, months, k, d, noise_level, seed, month_names):

    # The formatting of this data is a readable way was complete by ChatGPT
    data = {
        "meta": {
            "months": months,
            "daysPerMonth": days_per_month,
            "winningMonth": winning_month,
            "distracterMonths": distracter_months,
            "monthMeans": month_means,
            "k": k,
            "d": d,
            "noiseLevel": noise_level,
            "seed": seed
        },
        "months": [],
        "series": []
    }

    for m in range(months):
        data["months"].append({
            "monthIndex": m,
            "name": month_names[m] if month_names else str(m),
            "startDay": m * days_per_month
        })

    for i, v in enumerate(series):
        m = i // days_per_month
        dom = i % days_per_month
        data["series"].append({
            "dayIndex": i,
            "month": m,
            "dayOfMonth": dom,
            "value": float(v)
        })

    return data

if __name__ == "__main__":
    s, win, dist, means = generate_series(
        k=4,
        d=2,
        noise_level=2,
        winning_month=7,
        seed=1
    )

    print("Winning month:", MONTH_NAMES[win])

    data = convertToJSON(s, win, dist, means, DAYS_PER_MONTH, MONTHS, 4, 2, 2, 1, MONTH_NAMES)

    with open("data.json", "w") as f:
        json.dump(data, f)

    from common.plotting import plot_line, plot_colorfield

    # plot_line(s, permuted=False, title="Original Series")
    # plot_line(s, permuted=True, title="Permuted Series")
    plot_colorfield(s, permuted=False, title="Original Colorfield")
    # plot_colorfield(s, permuted=True, title="Permuted Colorfield")