from datetime import date, datetime, timedelta, timezone

import pytest

from app.modules.analytics.errors import InvalidPeriodError
from app.modules.analytics.utils.periods import (
    bucket_start,
    bucket_starts,
    day_range_bounds,
    elapsed_window,
    month_dates,
    shifted_window,
    to_utc_date,
)


def test_bucket_start_week_is_monday_and_month_is_first_day():
    wednesday = date(2026, 11, 4)

    assert bucket_start(wednesday, "day") == wednesday
    assert bucket_start(wednesday, "week") == date(2026, 11, 2)
    assert bucket_start(wednesday, "month") == date(2026, 11, 1)


def test_bucket_starts_has_no_gaps_and_includes_the_partial_first_week():
    starts = bucket_starts(date(2026, 11, 4), date(2026, 11, 18), "week")

    assert starts == [date(2026, 11, 2), date(2026, 11, 9), date(2026, 11, 16)]


def test_bucket_starts_months_cross_the_year_boundary():
    starts = bucket_starts(date(2026, 11, 20), date(2027, 2, 3), "month")

    assert starts == [date(2026, 11, 1), date(2026, 12, 1), date(2027, 1, 1), date(2027, 2, 1)]


def test_bucket_starts_rejects_inverted_and_oversized_ranges():
    with pytest.raises(InvalidPeriodError):
        bucket_starts(date(2026, 11, 5), date(2026, 11, 4), "day")
    with pytest.raises(InvalidPeriodError):
        bucket_starts(date(2020, 1, 1), date(2026, 1, 1), "day")


def test_day_range_bounds_is_half_open_and_includes_the_last_day():
    start, end = day_range_bounds(date(2026, 11, 1), date(2026, 11, 30))

    assert start == datetime(2026, 11, 1, tzinfo=timezone.utc)
    assert end == datetime(2026, 12, 1, tzinfo=timezone.utc)


def test_elapsed_window_stops_today_in_current_month_and_covers_past_months_fully():
    assert elapsed_window("2026-11", date(2026, 11, 9)) == (date(2026, 11, 1), date(2026, 11, 9))
    assert elapsed_window("2026-10", date(2026, 11, 9)) == (date(2026, 10, 1), date(2026, 10, 31))
    assert elapsed_window("2026-12", date(2026, 11, 9)) == (date(2026, 12, 1), date(2026, 12, 1))


def test_shifted_window_clamps_to_the_shorter_month():
    window = (date(2026, 3, 1), date(2026, 3, 31))

    assert shifted_window(window, "2026-03", -1) == (date(2026, 2, 1), date(2026, 2, 28))


def test_month_dates_handles_leap_years():
    assert month_dates("2028-02") == (date(2028, 2, 1), date(2028, 2, 29))


def test_to_utc_date_converts_aware_values_and_trusts_naive_ones():
    late_in_caracas = datetime(2026, 11, 8, 22, 0, tzinfo=timezone(timedelta(hours=-4)))

    assert to_utc_date(late_in_caracas) == date(2026, 11, 9)
    assert to_utc_date(datetime(2026, 11, 8, 22, 0)) == date(2026, 11, 8)
