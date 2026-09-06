"""Bridge bidding conventions manager and utility functions."""

import json
import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

from bridge_types import Auction, Bid, Hand


@dataclass
class VulnerabilityState:
    we: bool
    they: bool


class ConventionCard:
    """Manages bridge bidding conventions and their configuration."""

    SUITS = ["C", "D", "H", "S"]  # Suit ordering

    def __init__(self, config_path: str = "conventions.json"):
        if not os.path.exists(config_path):
            dir_path = os.path.dirname(__file__)
            fallback_path = os.path.join(dir_path, config_path)
            if os.path.exists(fallback_path):
                config_path = fallback_path
        self.config_path = config_path
        self.config = self._load_config()

    def _load_config(self) -> dict:
        """Load convention configuration from JSON file."""
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(
                f"Convention configuration file not found: {self.config_path}"
            )
        with open(self.config_path, "r") as f:
            return json.load(f)

    def is_enabled(self, convention: str, category: Optional[str] = None) -> bool:
        """Check if a specific convention is enabled."""
        try:
            if category:
                return self.config[category][convention]["enabled"]
            # Search all categories if not specified
            for cat in self.config:
                if (
                    isinstance(self.config[cat], dict)
                    and convention in self.config[cat]
                ):
                    return self.config[cat][convention]["enabled"]
            return False
        except KeyError:
            return False

    def _find_trump_suit(self, auction: Auction) -> Optional[str]:
        """Find the agreed trump suit from the auction context."""
        if not auction.bids:
            return None

        suit_bids = []
        last_suit_bid = None
        for bid in auction.bids:
            if not bid.token:  # Skip passes
                continue
            if bid.token[-1] in ["S", "H", "D", "C"]:
                suit_bids.append(bid)
                last_suit_bid = bid
        
        # No suit bids found
        if not last_suit_bid:
            return None

        # Look for explicit suit agreement
        if len(suit_bids) >= 2:
            last_suit = last_suit_bid.token[-1]
            
            # Consider it agreed if:
            # 1. The suit has been bid before
            for prev_bid in suit_bids[:-1]:
                if prev_bid.token[-1] == last_suit:
                    return last_suit
                    
            # 2. Last bid is jump to game in a major
            if (len(last_suit_bid.token) == 2 
                and last_suit_bid.token[0] == "4" 
                and last_suit in ["S", "H"]):
                return last_suit

        return None

    def _count_rkcb_keycards(self, hand: Hand, trump_suit: str) -> Tuple[int, bool]:
        """Count key cards (4 aces + trump king) and queen for RKCB.
        Returns (keycard_count, has_trump_queen)."""
        # Count aces
        keycards = sum(
            1
            for suit in ["S", "H", "D", "C"]
            for card in hand.suit_buckets[suit]
            if card.rank == "A"
        )

        # Add trump king if present
        if any(card.rank == "K" for card in hand.suit_buckets[trump_suit]):
            keycards += 1

        # Check for trump queen
        has_trump_queen = any(
            card.rank == "Q" for card in hand.suit_buckets[trump_suit]
        )

        return keycards, has_trump_queen

    def get_convention_setting(
        self, convention: str, setting: str, category: Optional[str] = None
    ) -> any:
        """Get a specific setting for a convention."""
        try:
            if category:
                return self.config[category][convention][setting]
            # Search all categories
            for cat in self.config:
                if (
                    isinstance(self.config[cat], dict)
                    and convention in self.config[cat]
                ):
                    return self.config[cat][convention][setting]
            return None
        except KeyError:
            return None

    def is_ace_asking_bid(self, auction: "Auction", bid: "Bid") -> Tuple[bool, str]:
        """Determine if a bid is an ace-asking bid and which convention applies."""
        # Store auction context for response generation
        self._last_auction = auction

        if not bid.token:
            return False, ""

        # Check for Gerber
        if (
            self.is_enabled("gerber", "ace_asking")
            and bid.token == "4C"
            and any(
                bid.token and "NT" in bid.token for bid in auction.bids
            )  # Check for any NT bid
        ):
            return True, "gerber"

        # Check for Blackwood/RKCB
        if bid.token == "4NT":
            if not self.is_enabled("blackwood", "ace_asking"):
                return False, ""

            # Look for the last contract before this asking bid.
            # The asking bid may or may not already be in the auction list.
            last_contract = None
            bids_to_scan = (
                auction.bids[:-1]
                if auction.bids and auction.bids[-1] is bid
                else auction.bids
            )
            for prev_bid in reversed(bids_to_scan):
                if prev_bid.token and not prev_bid.is_double and not prev_bid.is_redouble:
                    last_contract = prev_bid.token
                    break
            
            if not last_contract:
                return False, ""
                
            if last_contract[-2:] == "NT":
                return False, ""
                
            variant = self.get_convention_setting("blackwood", "variant", "ace_asking")
            
            # For RKCB, verify we have a trump suit established; if not, fall back to classic Blackwood
            if variant == "rkcb":
                trump_suit = self._find_trump_suit(auction)
                if not trump_suit:
                    return True, "blackwood_classic"
                return True, "blackwood_rkcb"
            return True, f"blackwood_{variant}"

        return False, ""

    def get_ace_asking_response(self, convention: str, hand: "Hand") -> Optional[str]:
        """Generate response to ace-asking bid based on convention."""
        if convention == "gerber":
            # Determine mapping from configuration if present. Expected shape:
            # config['ace_asking']['gerber']['responses_map'] = ["4D","4H","4S","4NT"]
            responses_map = self.get_convention_setting(
                "gerber", "responses_map", "ace_asking"
            )

            ace_count = sum(
                1
                for suit in ["S", "H", "D", "C"]
                for card in hand.suit_buckets[suit]
                if card.rank == "A"
            )

            # If a responses_map is configured and valid, use it. Index 0 -> 0 aces (also shown for 4 aces),
            # index 1 -> 1 ace, index 2 -> 2 aces, index 3 -> 3 aces.
            if (
                isinstance(responses_map, list)
                and len(responses_map) >= 4
                and all(isinstance(x, str) for x in responses_map[:4])
            ):
                idx = ace_count if ace_count < 4 else 0
                return responses_map[idx]

            # Default (standard) Gerber mapping fallback:
            # 4D = 0 (or 4), 4H = 1, 4S = 2, 4NT = 3
            if ace_count == 0 or ace_count == 4:
                return "4D"
            if ace_count == 1:
                return "4H"
            if ace_count == 2:
                return "4S"
            if ace_count == 3:
                return "4NT"
            return "4D"

        elif convention.startswith("blackwood"):
            responses = self.get_convention_setting(
                "blackwood", "responses", "ace_asking"
            )
            if convention == "blackwood_rkcb":
                # Count keycards (4 aces + trump king) and check for trump queen
                trump_suit = self._find_trump_suit(self._last_auction)
                if not trump_suit:
                    return None
                
                keycards, has_queen = self._count_rkcb_keycards(hand, trump_suit)
                # Roman Keycard responses:
                # 1430: 5♣=1/4, 5♦=3/0, 5♥=2 no Q, 5♠=2+Q, 5NT=odd+Q
                # 3014: 5♣=3/0, 5♦=1/4, 5♥=2 no Q, 5♠=2+Q, 5NT=odd+Q
                if responses == "1430":
                    if keycards in [1, 4]:
                        return "5C"
                    elif keycards in [3, 0]:
                        return "5D"
                    elif keycards == 2:
                        return "5H" if has_queen else "5S"
                    else:
                        return "5NT"  # even + void
                else:  # 3014 responses
                    if keycards in [3, 0]:
                        return "5C"
                    elif keycards in [1, 4]:
                        return "5D"
                    elif keycards == 2:
                        return "5H" if has_queen else "5S"
                    else:
                        return "5NT"  # even + void
            elif convention == "blackwood_classic":
                # Classic Blackwood: respond with number of aces
                ace_count = sum(
                    1
                    for suit in ["S", "H", "D", "C"]
                    for card in hand.suit_buckets[suit]
                    if card.rank == "A"
                )
                if ace_count == 0 or ace_count == 4:
                    return "5C"
                if ace_count == 1:
                    return "5D"
                if ace_count == 2:
                    return "5H"
                if ace_count == 3:
                    return "5S"
                return "5C"

        return None

    def is_two_suited_overcall(
        self, auction: "Auction", bid: "Bid", hand: Optional["Hand"] = None
    ) -> Tuple[bool, str, List[str]]:
        """Determine if a bid shows two suits and which suits are shown."""
        if not bid.token:
            return False, "", []

        # Check for Michaels Cue-bid
        if self.is_enabled("michaels", "competitive"):
            style = self.get_convention_setting("michaels", "strength", "competitive")
            direct_only = self.get_convention_setting(
                "michaels", "direct_only", "competitive"
            )

            # Skip if not direct seat and direct_only is True
            if direct_only and len(auction.bids) > 1:
                return False, "", []

            if (
                bid.token[0] == "2"
                and auction.last_contract()
                and auction.last_contract()[0] == "1"
                and bid.token[1] == auction.last_contract()[1]
            ):
                # Validate hand shape if provided
                if hand:
                    if style == "wide_range":
                        min_hcp = 6
                    else:  # "sound"
                        min_hcp = 10

                    if hand.hcp < min_hcp:
                        return False, "", []

                    # Need 5-5 or better for Michaels
                    sorted_lengths = sorted(
                        [(s, hand.lengths[s]) for s in self.SUITS],
                        key=lambda x: (-x[1], x[0]),
                    )
                    if sorted_lengths[0][1] < 5 or sorted_lengths[1][1] < 5:
                        return False, "", []

                if auction.last_contract()[1] in ["C", "D"]:
                    return True, "michaels", ["H", "S"]
                else:  # Major suit opening
                    other_major = "H" if auction.last_contract()[1] == "S" else "S"
                    return True, "michaels", [other_major, "C"]

        # Check for Unusual NT
        if self.is_enabled("unusual_nt", "notrump_defenses"):
            if (
                bid.token == "2NT"
                and auction.last_contract()
                and auction.last_contract()[0] == "1"
            ):
                return True, "unusual_nt", ["C", "D"]

        return False, "", []

    def adjust_for_vulnerability(
        self, bid_type: str, vul: VulnerabilityState
    ) -> Tuple[int, int]:
        """Adjust HCP requirements based on vulnerability."""
        if not self.config["general"]["vulnerability_adjustments"]:
            return 0, 0

        adjustments = {
            "overcall": {"fav": -1, "unfav": 1},
            "preempt": {"fav": -2, "unfav": 2},
            "weak_two": {"fav": -1, "unfav": 4},  # Very conservative when vulnerable
        }

        if bid_type not in adjustments:
            return 0, 0

        we_vul = vul.we
        they_vul = vul.they

        if we_vul and not they_vul:  # Unfavorable
            return adjustments[bid_type]["unfav"], 0
        elif not we_vul and they_vul:  # Favorable
            return adjustments[bid_type]["fav"], 0
        return 0, 0  # Equal vulnerability
