"""Turn a project's feedback close date into the closing moment the app shows."""

from datetime import date, datetime, time, timedelta, timezone


def _last_sunday(year: int, month: int) -> date:
    last = date(year, month + 1, 1) - timedelta(days=1)
    return last - timedelta(days=(last.weekday() + 1) % 7)


def feedback_deadline(closes: date) -> str:
    """The end of the close date in Southampton, in UTC like every other event deadline.

    UK summer time runs from the last Sunday of March to the last Sunday of October;
    23:59 is never near the 01:00 UTC switch, so the date alone decides the offset.
    """
    summer = _last_sunday(closes.year, 3) <= closes < _last_sunday(closes.year, 10)
    local = datetime.combine(closes, time(23, 59, 59))
    return (
        (local - timedelta(hours=int(summer))).replace(tzinfo=timezone.utc).isoformat()
    )
