DAYS_PER_MONTH = 30
MONTHS = 12

MONTH_NAMES = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
]

WINNING_MEAN_RANGE = (50, 98)
DISTRACTER_GAP_RANGE = (1, 10)
DISTRACTER_COUNT_RANGE = (2, 4)
MIN_MEAN = 20

DISTRACTER_COUNTS = list(range(DISTRACTER_COUNT_RANGE[0], DISTRACTER_COUNT_RANGE[1]+1))
DISTRACTER_GAPS = list(range(DISTRACTER_GAP_RANGE[0], DISTRACTER_GAP_RANGE[1]+1))

DEFAULT_NOISE_LEVEL = 2
NOISE_MAP = {
    1: dict(scale=8, amp=2, octaves=2),
    2: dict(scale=4, amp=5, octaves=3),
    3: dict(scale=2, amp=9, octaves=4)
}
NOISE_LEVELS = list(NOISE_MAP.keys())