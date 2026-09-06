"""Bridge bidding system with SAYC and configurable conventions."""

from typing import Optional

from bridge_types import Auction, Bid, Hand
from convention_manager import ConventionCard, VulnerabilityState

# Constants
SUITS = ["C", "D", "H", "S"]


class BiddingSystem:
    """Bridge bidding system implementing SAYC with configurable conventions."""

    def __init__(self, convention_config: str = "conventions.json"):
        self.conventions = ConventionCard(convention_config)
        self.current_auction: Optional[Auction] = None
        self.vulnerability: Optional[VulnerabilityState] = None
        self.our_seat: Optional[str] = None  # 'N','E','S','W'

    def start_auction(self, our_seat: str, vul_we: bool = False, vul_they: bool = False):
        """Start a new auction.

        Note: The first parameter represents our seat (N/E/S/W). Dealer is optional
        and can be set when constructing Auction separately if needed. Seats will be
        auto-assigned assuming LHO opens when bids are added without an explicit dealer.
        """
        self.our_seat = our_seat
        self.current_auction = Auction(our_seat=our_seat)
        self.vulnerability = VulnerabilityState(vul_we, vul_they)

    def start_auction_with_dealer(
        self,
        our_seat: str,
        dealer: str,
        vul_we: bool = False,
        vul_they: bool = False,
    ) -> None:
        """Start a new auction with both our seat and the dealer specified.

        Seats will be assigned in strict rotation from the dealer for all bids.
        """
        self.our_seat = our_seat
        self.current_auction = Auction(our_seat=our_seat, dealer=dealer)
        self.vulnerability = VulnerabilityState(vul_we, vul_they)

    def _is_opening_bid(self) -> bool:
        """Check if this is an opening bid."""
        return len(self.current_auction.bids) == 0

    def _get_opening_bid(self, hand: Hand) -> Optional[Bid]:
        """Get appropriate opening bid for the hand."""
        total_points = hand.hcp + hand.distribution_points

        # 2C Strong opening
        if hand.hcp >= 22:
            return Bid("2C")

        # 1NT opening
        balanced = all(length <= 5 for length in hand.lengths.values())
        if balanced and 15 <= hand.hcp <= 17:
            return Bid("1NT")

        # Natural suit opening
        if total_points >= 12:
            # Find longest suit
            suits = sorted(SUITS, key=lambda s: (-hand.lengths[s], s))
            if hand.lengths[suits[0]] >= 5:
                return Bid(f"1{suits[0]}")

            # Open 1 of shorter minor with 4-4-3-2 or 4-3-3-3
            if hand.lengths["C"] >= 3:
                return Bid("1C")
            return Bid("1D")

        return None

    def _handle_interference(self, auction: Auction, hand: Hand) -> Optional[Bid]:
        """Handle opponent's interference."""
        last_bid = auction.bids[-1]

        # Check for opponents' 1NT opening
        if (
            len(auction.bids) == 1
            and last_bid.token == "1NT"
            and self.conventions.is_enabled("dont", "notrump_defenses")
        ):
            # DONT convention
            for suit in SUITS:
                if hand.lengths[suit] >= 6:
                    return Bid(f"2{suit}")  # Natural
            # Find two longest suits for two-suited hands
            suits = sorted(SUITS, key=lambda s: (-hand.lengths[s], s))
            if hand.lengths[suits[0]] >= 5 and hand.lengths[suits[1]] >= 4:
                return Bid("2C")  # Shows clubs and another suit

        return None

    def _handle_ace_asking(self, auction: Auction, hand: Hand) -> Optional[Bid]:
        """Handle ace-asking bids."""
        if not auction.bids:
            return None

        last_bid = auction.bids[-1]
        is_asking, convention = self.conventions.is_ace_asking_bid(auction, last_bid)

        if is_asking:
            response = self.conventions.get_ace_asking_response(convention, hand)
            return Bid(response) if response else None

        return None

    def get_bid(self, hand: Hand) -> Bid:
        """Get the next bid for the given hand."""
        if not self.current_auction:
            raise ValueError("Auction not started")

        # Opening bid
        if self._is_opening_bid():
            bid = self._get_opening_bid(hand)
            return bid if bid else Bid(None)  # Pass if no suitable opening

        # Handle opponent's last bid
        if len(self.current_auction.bids) % 2 == 1:  # Opponent's bid
            interference_bid = self._handle_interference(self.current_auction, hand)
            if interference_bid:
                return interference_bid

        # Check for ace-asking sequences
        ace_asking_response = self._handle_ace_asking(self.current_auction, hand)
        if ace_asking_response:
            return ace_asking_response

        # Default to pass if no other action found
        return Bid(None)
