"""Type definitions for bridge bidding system."""

from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class Card:
    """Represents a playing card."""

    rank: str
    suit: str


POINTS = {"J": 1, "Q": 2, "K": 3, "A": 4}  # High-card points (HCP)


@dataclass
class Hand:
    """Represents a bridge hand."""

    suit_buckets: dict[str, List[Card]] | str

    def __post_init__(self):
        """Calculate hand properties after initialization."""
        if isinstance(self.suit_buckets, str):
            # Parse PBN-style hand string like "AKQ2 J432 32 32"
            parts = self.suit_buckets.split()
            if len(parts) != 4:
                raise ValueError(
                    "Invalid hand string format. Expected 4 space-separated suit strings."
                )
            suits = ["S", "H", "D", "C"]
            self.suit_buckets = {}
            for suit, cards in zip(suits, parts):
                self.suit_buckets[suit] = [Card(rank=r, suit=suit) for r in cards]

        self.lengths = {suit: len(cards) for suit, cards in self.suit_buckets.items()}
        self.hcp = sum(
            POINTS.get(card.rank, 0)
            for cards in self.suit_buckets.values()
            for card in cards
        )
        # Distribution points: void=3, singleton=2, doubleton=1
        self.distribution_points = sum(
            3 if length == 0 else 2 if length == 1 else 1 if length == 2 else 0
            for length in self.lengths.values()
        )


@dataclass
class Bid:
    """Represents a bridge bid."""

    token: Optional[str]  # None for Pass
    is_double: bool = False
    is_redouble: bool = False
    convention_used: Optional[str] = None  # Name of convention if bid is conventional
    seat: Optional[str] = None  # 'N','E','S','W' of the player who made the bid


class Auction:
    """Represents a bridge auction with optional seat/position tracking."""

    TURN_ORDER = ["N", "E", "S", "W"]

    def __init__(
        self,
        bids: List[Bid] | None = None,
        *,
        our_seat: Optional[str] = None,
        dealer: Optional[str] = None,
    ):
        self.bids: List[Bid] = bids if bids else []
        self.our_seat: Optional[str] = our_seat
        self.dealer: Optional[str] = dealer

        # If dealer is known, assign seats to existing bids in order
        if self.dealer and self.bids:
            start_idx = self.TURN_ORDER.index(self.dealer)
            for i, b in enumerate(self.bids):
                if b.seat is None:
                    b.seat = self.TURN_ORDER[(start_idx + i) % 4]

    def last_contract(self) -> Optional[str]:
        """Returns the last contract bid in the auction."""
        for bid in reversed(self.bids):
            if bid.token and not bid.is_double and not bid.is_redouble:
                return bid.token
        return None

    def is_closed(self) -> bool:
        """Check if the auction is closed (3 consecutive passes or 4 passes total)."""
        if len(self.bids) < 3:
            return False
        # Check for three consecutive passes
        last_three = self.bids[-3:]
        if len(last_three) == 3 and all(bid.token is None for bid in last_three):
            return True
        # Check for four passes from start
        if len(self.bids) == 4 and all(bid.token is None for bid in self.bids):
            return True
        return False

    def add(self, bid: Bid) -> None:
        """Add a bid to the auction, auto-assigning seat when possible."""
        if bid.seat is None and self.dealer:
            # If dealer is known, follow strict rotation
            start_idx = self.TURN_ORDER.index(self.dealer)
            next_idx = (start_idx + len(self.bids)) % 4
            bid.seat = self.TURN_ORDER[next_idx]
        self.bids.append(bid)

    def last_bidder_seat(self) -> Optional[str]:
        """Return the seat (N/E/S/W) of the last non-pass bid, if known."""
        for bid in reversed(self.bids):
            if bid.token is not None:
                return bid.seat
        return None

    def last_side(self) -> Optional[str]:
        """Return 'we' if last bid was by our side, 'they' if by opponents, else None."""
        seat = self.last_bidder_seat()
        if not seat or not self.our_seat:
            return None
        # Our side seats are the same polarity (N/S) or (E/W)
        us = self.our_seat in ("N", "S")
        them = not us
        last_is_ns = seat in ("N", "S")
        if us and last_is_ns:
            return "we"
        if them and not last_is_ns:
            return "they"
        # Opposite cases
        return "they" if us else "we"

    def reseat(self, dealer: str) -> None:
        """Set dealer and assign seats to all existing bids in rotation.

        This overwrites any previously assigned bid.seat values to ensure consistency.
        """
        if dealer not in self.TURN_ORDER:
            raise ValueError("Dealer must be one of 'N','E','S','W'")
        self.dealer = dealer
        start_idx = self.TURN_ORDER.index(self.dealer)
        for i, b in enumerate(self.bids):
            b.seat = self.TURN_ORDER[(start_idx + i) % 4]
