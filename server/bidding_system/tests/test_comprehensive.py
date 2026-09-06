"""Comprehensive tests for all bridge bidding functionality."""

import unittest

from bridge_types import Bid, Card, Hand
from sayc_system import SAYCBiddingSystem


def make_hand_from_pattern(spades: str, hearts: str, diamonds: str, clubs: str) -> Hand:
    """Create a hand from string patterns like 'AKQ32' for each suit."""
    suits = {"S": spades, "H": hearts, "D": diamonds, "C": clubs}
    buckets = {s: [] for s in ["C", "D", "H", "S"]}
    for suit, pattern in suits.items():
        for rank in pattern:
            buckets[suit].append(Card(rank=rank, suit=suit))
    return Hand(buckets)


class TestComprehensive(unittest.TestCase):
    def setUp(self):
        self.system = SAYCBiddingSystem()
        self.conventions = self.system.conventions

    def test_rule_of_20(self):
        """Test Rule of 20 opening decisions."""
        # Rule of 20: HCP + two longest suits >= 20
        hands = [
            # Should open (11 HCP + 5 + 4 = 20)
            (make_hand_from_pattern("AKQ32", "J432", "32", "32"), True),
            # Should not open (11 HCP + 4 + 3 = 18)
            (make_hand_from_pattern("AKQ2", "J32", "432", "432"), False),
            # Should open balanced (12 HCP + 4 + 4 = 20)
            (make_hand_from_pattern("AKQ2", "KJ32", "432", "32"), True),
        ]

        for hand, should_open in hands:
            bid = self.system._get_opening_bid(hand)
            self.assertEqual(bool(bid), should_open)

    def test_six_hcp_overcalls(self):
        """Test direct overcalls with minimum values."""
        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1C"))  # Opponent opens 1C

        hands = [
            # 6 HCP, 5-card suit - should overcall
            (make_hand_from_pattern("KQ432", "432", "432", "32"), True),
            # 5 HCP, 5-card suit - should not overcall
            (make_hand_from_pattern("KJ432", "432", "432", "32"), False),
            # 6 HCP, 4-card suit - should not overcall
            (make_hand_from_pattern("KQ32", "432", "4332", "32"), False),
        ]

        for hand, should_overcall in hands:
            bid = self.system.get_bid(hand)
            self.assertEqual(bool(bid and bid.token), should_overcall)

    def test_relaxed_takeout_doubles(self):
        """Test relaxed requirements for takeout doubles."""
        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1H"))  # Opponent opens 1H

        hands = [
            # Classic takeout double (4-4-3-2)
            (make_hand_from_pattern("AKQ2", "2", "KJ32", "Q432"), "X"),
            # Relaxed shape with two 3-card suits (3-3-3-4)
            (make_hand_from_pattern("AK2", "2", "KJ2", "QJ432"), "X"),
            # Minimum with two 2-card suits (2-2-4-5)
            (make_hand_from_pattern("K2", "2", "AKJ2", "QJ432"), "X"),
            # Too weak for relaxed double (2-2-4-5)
            (make_hand_from_pattern("Q2", "2", "KJ32", "J4332"), None),
        ]

        for hand, expected in hands:
            bid = self.system.get_bid(hand)
            if expected == "X":
                self.assertTrue(bid.is_double)
            else:
                self.assertFalse(getattr(bid, "is_double", False))

    def test_jacoby_2nt(self):
        """Test Jacoby 2NT responses."""
        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1S"))  # Partner opens 1S

        # Initialize system with proper conventions
        self.conventions.config.setdefault("responses", {})["jacoby_2nt"] = {
            "enabled": True,
            "description": "When responder has 4+ card support for partner's 1H/1S and 13+ HCP, 2NT is Jacoby (game forcing).",
        }

        hands = [
            # Perfect Jacoby 2NT (4 spades, 13 HCP)
            (make_hand_from_pattern("KQ32", "AK32", "Q32", "32"), "2NT"),
            # Too weak for Jacoby 2NT
            (make_hand_from_pattern("KQ32", "K432", "Q32", "32"), None),
            # Not enough trump support
            (make_hand_from_pattern("K32", "AKQ2", "QJ2", "432"), None),
        ]

        for hand, expected in hands:
            bid = self.system.get_bid(hand)
            self.assertEqual(getattr(bid, "token", None), expected)

    def test_gerber_responses(self):
        """Test Gerber ace-asking responses."""
        # Enable Gerber convention
        self.conventions.config.setdefault("slam_conventions", {})["gerber"] = {
            "enabled": True,
            "responder_only": False,
        }

        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1NT"))
        self.system.current_auction.add(Bid(None))  # Pass
        self.system.current_auction.add(Bid("4C"))  # Gerber

        hands = [
            # 0 aces -> 4D
            (make_hand_from_pattern("KQ32", "KQ32", "Q32", "K2"), "4D"),
            # 1 ace -> 4H
            (make_hand_from_pattern("A432", "K432", "Q32", "K2"), "4H"),
            # 2 aces -> 4S
            (make_hand_from_pattern("A432", "A432", "Q32", "K2"), "4S"),
            # 3 aces -> 4NT
            (make_hand_from_pattern("A432", "A432", "A32", "K2"), "4NT"),
            # 4 aces -> 4D
            (make_hand_from_pattern("A432", "A432", "A32", "A2"), "4D"),
        ]

        for hand, expected in hands:
            asking_bid = self.system.current_auction.bids[-1]
            is_asking, conv = self.conventions.is_ace_asking_bid(
                self.system.current_auction, asking_bid
            )
            self.assertTrue(is_asking)
            self.assertEqual(conv, "gerber")
            response = self.conventions.get_ace_asking_response(conv, hand)
            self.assertEqual(response, expected)

    def test_balanced_hands(self):
        """Test balanced hand patterns and interactions."""
        hands = [
            # 4-3-3-3 is balanced
            (make_hand_from_pattern("AKQ2", "K32", "Q32", "432"), True),
            # 4-4-3-2 is balanced
            (make_hand_from_pattern("AKQ2", "KJ32", "Q32", "32"), True),
            # 5-3-3-2 is balanced
            (make_hand_from_pattern("AKQ32", "K32", "Q32", "32"), True),
            # 5-4-2-2 is not balanced
            (make_hand_from_pattern("AKQ32", "KJ32", "32", "32"), False),
            # 6-3-2-2 is not balanced
            (make_hand_from_pattern("AKQ432", "K32", "32", "32"), False),
        ]

        for hand, is_balanced in hands:
            self.assertEqual(self.system._is_balanced(hand), is_balanced)

    def test_meckwell_defenses(self):
        """Test Meckwell defense against 1NT."""
        # Disable DONT and enable only Meckwell
        self.conventions.config.setdefault("notrump_defenses", {})["dont"] = {
            "enabled": False
        }
        self.conventions.config.setdefault("notrump_defenses", {})["meckwell"] = {
            "enabled": True,
            "direct_only": True,
        }

        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1NT"))

        hands = [
            # Single-suited hand -> 2C
            (make_hand_from_pattern("AKQ432", "32", "432", "32"), "2C"),
            # Both majors -> 2D
            (make_hand_from_pattern("KQJ2", "KQJ2", "432", "32"), "2D"),
            # Major + minor -> 2M
            (make_hand_from_pattern("KQJ32", "32", "KQJ32", "32"), "2S"),
        ]

        for hand, expected in hands:
            bid = self.system.get_bid(hand)
            self.assertEqual(getattr(bid, "token", None), expected)

    def test_lebensohl_sequences(self):
        """Test lebensohl responses to interference."""
        # Set up lebensohl convention
        self.conventions.config.setdefault("notrump_defenses", {})["lebensohl"] = {
            "enabled": True,
            "after_interference": True,
            "fast_denies": True,
        }

        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1NT"))
        self.system.current_auction.add(Bid(None))  # Pass
        self.system.current_auction.add(Bid("2H"))  # Interference

        hands = [
            # Fast denial with stopper
            (make_hand_from_pattern("AK32", "KQ2", "QJ32", "32"), "3NT"),
            # Slow sequence with weak hand
            (make_hand_from_pattern("32", "32", "QJ9432", "432"), "2NT"),
            # Game force without stopper
            (make_hand_from_pattern("AKQ2", "2", "KQJ32", "432"), "3H"),
        ]

        for hand, expected in hands:
            bid = self.system.get_bid(hand)
            self.assertEqual(getattr(bid, "token", None), expected)

    def test_support_doubles(self):
        """Test support doubles in competition."""
        # Enable support doubles convention
        self.conventions.config.setdefault("competitive_bidding", {})[
            "support_doubles"
        ] = {
            "enabled": True,
            "thru": "2S",  # Support doubles through 2S
        }

        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1D"))  # We open
        self.system.current_auction.add(Bid("1S"))  # They overcall
        self.system.current_auction.add(Bid("1H"))  # Partner bids hearts

        hands = [
            # Perfect support double
            (make_hand_from_pattern("32", "KQ2", "AKJ32", "432"), True),
            # Four-card support -> natural raise
            (make_hand_from_pattern("32", "KQJ2", "AKJ32", "32"), False),
            # Two-card support -> no double
            (make_hand_from_pattern("432", "32", "AKJ32", "KQ2"), False),
        ]

        for hand, should_double in hands:
            bid = self.system.get_bid(hand)
            self.assertEqual(getattr(bid, "is_double", False), should_double)


if __name__ == "__main__":
    unittest.main()
