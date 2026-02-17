import matplotlib.pyplot as plt
from common.utils import permute_line, permute_colorfield
from common.constants import MONTHS, DAYS_PER_MONTH, MONTH_NAMES
import numpy as np



def _month_axis(ax, days_per_month=DAYS_PER_MONTH, offset=0):
    """Add month ticks + boundaries"""
    months = MONTHS

    # vertical boundary lines
    for m in range(months + 1):
        ax.axvline(m*days_per_month + offset, color="black", alpha=0.3, linewidth=1, zorder=10)

    # ticks centered in each month
    centers = np.arange(months)*days_per_month + days_per_month/2 + offset
    ax.set_xticks(centers)
    ax.set_xticklabels(MONTH_NAMES)

    ax.set_xlim(offset, months * days_per_month + offset)


def plot_line(series, permuted=False, days_per_month=DAYS_PER_MONTH, title=""):
    if permuted:
        series = permute_line(series, days_per_month)

    fig, ax = plt.subplots(figsize=(11,7))

    ax.plot(series, linewidth=1.8, zorder=5)

    ax.set_ylim(0, 100)
    ax.set_ylabel("Value")
    ax.set_xlabel("Month")
    ax.set_title(title)

    _month_axis(ax, days_per_month, offset=0)

    plt.tight_layout()
    plt.show()

def plot_colorfield(series, permuted=False, height=20, days_per_month=DAYS_PER_MONTH, title=""):
    mat = np.tile(series, (height, 1))

    if permuted:
        mat = permute_colorfield(mat)

    fig, ax = plt.subplots(figsize=(11, 3))

    im = ax.imshow(
        mat,
        aspect='auto',
        cmap='coolwarm',
        vmin=0,
        vmax=100,
        zorder=1
    )

    # Add month boundaries and labels
    # AI Usage Note: For the colorfield plot, can you make it so that there are grid lines like in the line plot that correspond to the end of the months, and then make the month name centered on the month range between the lines?
    _month_axis(ax, days_per_month, offset=-0.5)

    ax.set_yticks([])
    ax.set_xlabel("Month")
    ax.set_title(title)

    plt.colorbar(im, ax=ax, label="Value")
    plt.tight_layout()
    plt.show()