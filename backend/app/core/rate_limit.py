"""In-memory sliding-window rate limiting — docs/MASTER_PLAN.md §9
(Phase 8 "hardening": rate limiting). A personal, single-process app
has no need for a shared store like Redis; this trades cross-process
correctness (fine, since there's one process) for zero extra
infrastructure. Two things are worth capping even for a single user:
brute-forcing the one login endpoint, and runaway LLM spend from a
retry loop or a stuck client hammering a streaming/research endpoint.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class RateLimiter:
    """One limiter per endpoint (or endpoint group) it guards, keyed by
    client IP — so hitting one limited route never eats another's
    budget."""

    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        hits = self._hits[key]
        while hits and hits[0] < cutoff:
            hits.pop(0)
        if len(hits) >= self.max_requests:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests — slow down and try again shortly.")
        hits.append(now)

    def dependency(self):
        def _dep(request: Request) -> None:
            self.check(_client_ip(request))
        return _dep


def _client_ip(request: Request) -> str:
    # Trusts the proxy's forwarded header when present (same-origin Next.js
    # proxy sits in front of this API in the intended deployment); falls
    # back to the raw peer address otherwise.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Login: brute-force protection on the one auth endpoint.
login_limiter = RateLimiter(max_requests=10, window_seconds=5 * 60)

# LLM-cost-incurring endpoints: generous enough for real use, tight enough
# to catch a retry loop or a stuck client before it runs up a real bill.
llm_call_limiter = RateLimiter(max_requests=20, window_seconds=60)
