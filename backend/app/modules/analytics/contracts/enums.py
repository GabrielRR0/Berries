"""Valores permitidos que comparten los controllers y los services."""

from typing import Literal

Granularity = Literal["day", "week", "month"]
CompareAgainst = Literal["previous", "year_ago", "average"]
InsightLevel = Literal["alert", "warning", "info"]
