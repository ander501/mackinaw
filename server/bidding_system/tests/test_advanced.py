"""Tests for advanced conventions and edge cases."""

import unittest

from bridge_types import Auction, Bid, Card, Hand
from sayc_system import SAYCBiddingSystem


def make_hand_from_ranks(ranks_by_suit):
    """Create a Hand from a mapping suit->list_of_ranks."""
    SUITS = ["C", "D", "H", "S"]
    buckets = {s: [] for s in SUITS}
    total = 0
    for s, ranks in ranks_by_suit.items():
        for r in ranks:
            buckets[s].append(Card(rank=r, suit=s))
        total += len(ranks)

    # pad clubs with low cards if needed
    while total < 13:
        buckets["C"].append(Card(rank="2", suit="C"))
        total += 1

    return Hand(buckets)


class TestAdvancedConventions(unittest.TestCase):
    def setUp(self):
        self.system = SAYCBiddingSystem('tests/test_conventions.json')
        self.conventions = self.system.conventions

    def test_rkcb_responses(self):
        # Set up an auction with agreed spades
        auction = Auction()
        auction.add(Bid("1S"))
        auction.add(Bid(None))  # Pass
        auction.add(Bid("4S"))
        auction.add(Bid(None))  # Pass
        auction.add(Bid("4NT"))  # RKCB

        # Test 1430 responses (default)
        self.conventions.config["ace_asking"]["blackwood"]["responses"] = "1430"

        # Hand with 1 keycard (ace of spades)
        hand1 = make_hand_from_ranks(
            {"S": ["A", "2", "3", "4"], "H": ["2"], "D": ["2", "3"], "C": []}
        )
        is_asking, conv = self.conventions.is_ace_asking_bid(auction, auction.bids[-1])
        self.assertTrue(is_asking)
        resp = self.conventions.get_ace_asking_response(conv, hand1)
        self.assertEqual(resp, "5C")  # 1430: 5♣ shows 1 or 4

        # Hand with 2 keycards (ace + king of spades) and queen
        hand2 = make_hand_from_ranks(
            {"S": ["A", "K", "Q", "2"], "H": ["2"], "D": ["2", "3"], "C": []}
        )
        resp = self.conventions.get_ace_asking_response(conv, hand2)
        self.assertEqual(resp, "5H")  # 5♥ shows 2 + queen

    def test_michaels_cuebid(self):
        # Opponent opens 1H
        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1H"))

        # We have spades and clubs
        ranks = {
            "S": ["A", "K", "Q", "2", "3"],  # 5 spades
            "H": ["2"],  # singleton heart
            "C": ["K", "Q", "J", "2", "3"],  # 5 clubs
            "D": [],
        }
        hand = make_hand_from_ranks(ranks)
        bid = self.system.get_bid(hand)
        self.assertEqual(bid.token, "2H")  # Michaels showing spades + clubs

    def test_dont_over_1nt(self):
        # Opponent opens 1NT
        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1NT"))

        # We have a good diamond suit
        ranks = {
            "S": ["2", "3"],
            "H": ["2", "3"],
            "D": ["A", "K", "Q", "J", "2", "3"],  # 6 diamonds
            "C": ["2", "3"],
        }
        hand = make_hand_from_ranks(ranks)
        bid = self.system.get_bid(hand)
        self.assertEqual(bid.token, "2D")  # DONT: natural suit overcall

    def test_lebensohl_after_interference(self):
        # Our 1NT - (2H) sequence
        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1NT"))
        self.system.current_auction.add(Bid(None))  # Pass
        self.system.current_auction.add(Bid("2H"))  # Interference

        # We have a weak hand with long spades
        ranks = {
            "S": ["K", "J", "10", "9", "8", "2"],  # 6 spades
            "H": ["2", "3"],
            "D": ["2", "3"],
            "C": ["2", "3"],
        }
        hand = make_hand_from_ranks(ranks)
        bid = self.system.get_bid(hand)
        self.assertEqual(bid.token, "2NT")  # Lebensohl

    def test_vulnerability_adjustments(self):
        # Test weak two adjustments when vulnerable
        self.system.start_auction("N", vul_we=True, vul_they=False)  # We're vulnerable

        # Borderline weak two hand
        ranks = {
            "S": ["K", "Q", "J", "10", "9", "8"],  # 6 spades
            "H": ["2", "3"],
            "D": ["K", "2"],
            "C": ["2", "3"],
        }
        hand = make_hand_from_ranks(ranks)
        bid = self.system.get_bid(hand)
        self.assertIsNone(bid.token)  # Should pass when vulnerable

        # Same hand not vulnerable
        self.system.start_auction("N", vul_we=False, vul_they=True)
        bid = self.system.get_bid(hand)
        self.assertEqual(bid.token, "2S")  # Can open 2S non-vulnerable

    def test_passed_hand_variations(self):
        # Test drury responses after passing
        self.system.start_auction("N")
        self.system.current_auction.add(Bid(None))  # We pass
        self.system.current_auction.add(Bid(None))  # LHO passes
        self.system.current_auction.add(Bid("1S"))  # Partner opens 1S
        self.system.current_auction.add(Bid(None))  # RHO passes

        # Drury hand: 3-card support and 10 HCP
        ranks = {
            "S": ["K", "Q", "2"],  # 3 spades
            "H": ["K", "Q"],
            "D": ["K", "Q"],
            "C": ["J", "2", "3", "4"],
        }
        hand = make_hand_from_ranks(ranks)
        bid = self.system.get_bid(hand)
        self.assertEqual(bid.token, "2C")  # Drury


if __name__ == "__main__":
    unittest.main()
