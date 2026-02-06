import matplotlib.pyplot as plt
from common.utils import permute_line, permute_colorfield
from common.constants import MONTHS, DAYS_PER_MONTH, MONTH_NAMES
import numpy as np



def _month_axis(ax, days_per_month=DAYS_PER_MONTH):
    """Add month ticks + boundaries"""
    months = MONTHS

    # vertical boundary lines
    for m in range(months + 1):
        ax.axvline(m*days_per_month, color="gray", alpha=0.35, linewidth=1)

    # ticks centered in each month
    centers = np.arange(months)*days_per_month + days_per_month/2
    ax.set_xticks(centers)
    ax.set_xticklabels(MONTH_NAMES)

    ax.set_xlim(0, months*days_per_month)


def plot_line(series, permuted=False, days_per_month=DAYS_PER_MONTH, title=""):
    if permuted:
        series = permute_line(series, days_per_month)

    fig, ax = plt.subplots(figsize=(11,7))

    ax.plot(series, linewidth=1.8)

    ax.set_ylim(0, 100)
    ax.set_ylabel("Value")
    ax.set_xlabel("Month")
    ax.set_title(title)

    _month_axis(ax, days_per_month)

    plt.tight_layout()
    plt.show()

def plot_colorfield(series, permuted=False, height=20, days_per_month=DAYS_PER_MONTH, title=""):
    mat = np.tile(series, (height, 1))

    if permuted:
        mat = permute_colorfield(mat)

    fig, ax = plt.subplots(figsize=(11, 2.8))

    im = ax.imshow(
        mat,
        aspect='auto',
        cmap='coolwarm',
        vmin=0,
        vmax=100
    )

    _month_axis(ax, days_per_month)

    ax.set_yticks([])
    ax.set_xlabel("Month")
    ax.set_title(title)

    plt.colorbar(im, ax=ax, label="Value")
    plt.tight_layout()
    plt.show()