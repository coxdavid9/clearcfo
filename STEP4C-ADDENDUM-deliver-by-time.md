# Step 4c addendum — "deliver BY the chosen time"

## Problem
With a 15-minute dispatcher and "due = chosen time already passed", an owner who picks 7:00 AM gets the email between 7:00 and ~7:15. The product promise should be "in your inbox by 7:00".

## Fix
- Dispatcher cron runs every 5 minutes.
- A company is due when its chosen local delivery time is within the next 5 minutes, while the existing not-yet-sent watermark check still passes.
- If a run starts late, the existing "already passed and not sent" behavior still delivers it once.
- No schema change.

## Tests
- Alert at 7:00 is due at 6:57.
- Alert at 6:50 is not due.
- Alert remains idempotent after a send.
- Weekly report uses the same five-minute lookahead.
- Existing timezone/DST and validation scenarios remain covered.

## Validation
All six CI checks must be green before merge.
