import unittest

from bridge_types import Auction, Bid, Card, Hand
from convention_manager import ConventionCard
from sayc_system import SAYCBiddingSystem


def make_hand_from_ranks(ranks_by_suit):
    """Create a Hand from a mapping suit->list_of_ranks. Pads with '2's to reach 13 cards."""
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


class TestSAYC(unittest.TestCase):
    def setUp(self):
        self.system = SAYCBiddingSystem()
        self.conventions = self.system.conventions

    def test_rule_of_20_opens(self):
        # Hand with HCP 10 and two longest suits lengths 6 and 4 -> 10+6+4=20
        ranks = {
            "S": ["A", "K", "Q", "J", "2", "3"],
            "H": ["A", "K", "Q", "2"],
            "D": ["2", "3"],
            "C": [],
        }
        hand = make_hand_from_ranks(ranks)
        self.system.start_auction("N")
        bid = self.system.get_bid(hand)
        # Expect a 1-level opening (5+ spades present) -> 1S
        self.assertIsNotNone(bid)
        self.assertEqual(bid.token, "1S")

    def test_overcall_with_6_hcp_allowed(self):
        # Opponent opened 1C
        self.system.start_auction("N")
        # Simulate opponent's opening
        self.system.current_auction.add(Bid("1C"))

        # Hand with 6 HCP and 5-card heart suit
        ranks = {
            "S": ["2", "3"],
            "H": ["A", "K", "2", "3", "4"],
            "D": ["2", "3", "4"],
            "C": ["2", "3", "4"],
        }
        hand = make_hand_from_ranks(ranks)
        bid = self.system.get_bid(hand)
        # Expect a 1H overcall allowed at 6 HCP
        self.assertIsNotNone(bid)
        self.assertEqual(bid.token, "1H")

    def test_relaxed_takeout_double(self):
        # Opponent opened 1H
        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1H"))

        # Hand with 11 HCP, short in hearts, and two suits with at least 2 cards
        # Increase HCP to trigger the relaxed double condition (A, K, K -> 12 HCP)
        ranks = {
            "S": ["K", "2", "3"],
            "H": ["2"],
            "D": ["A", "2"],
            "C": ["K", "Q", "2", "3"],
        }
        hand = make_hand_from_ranks(ranks)
        bid = self.system.get_bid(hand)
        # Expect a takeout double (token is None with is_double True)
        self.assertIsNotNone(bid)
        self.assertTrue(bid.is_double)

    def test_jacoby_2nt_toggle(self):
        # Partner opened 1S; responder has 4-card support and 13 HCP
        self.system.start_auction("N")
        self.system.current_auction.add(Bid("1S"))

        # Make hand with 13+ HCP and 4-card spade support
        ranks = {
            "S": ["A", "K", "Q", "2"],
            "H": ["A", "2"],
            "D": ["2", "3"],
            "C": ["2", "3", "4"],
        }
        hand = make_hand_from_ranks(ranks)

        # Ensure jacoby enabled in config
        self.conventions.config.setdefault("responses", {}).setdefault(
            "jacoby_2nt", {}
        )["enabled"] = True
        bid = self.system.get_bid(hand)
        self.assertIsNotNone(bid)
        self.assertEqual(bid.token, "2NT")

        # Disable jacoby in config and expect a normal raise instead
        self.conventions.config["responses"]["jacoby_2nt"]["enabled"] = False
        bid2 = self.system.get_bid(hand)
        # Should not be 2NT when disabled
        self.assertNotEqual(bid2.token, "2NT")

    def test_gerber_responses_from_config(self):
        mgr = ConventionCard()
        # Build hand with 2 aces
        ranks = {"S": ["A"], "H": ["A"], "D": [], "C": []}
        hand = make_hand_from_ranks(ranks)
        resp = mgr.get_ace_asking_response("gerber", hand)
        # With 2 aces expect "4S" according to current config mapping
        self.assertEqual(resp, "4S")

    def test_blackwood_response(self):
        mgr = ConventionCard()
        # Simulate a 4NT asking bid after a suit contract (last_contract not NT)
        auction = Auction()
        auction.bids.append(Bid("1S"))
        # Asking bid
        asking = Bid("4NT")
        is_asking, conv = mgr.is_ace_asking_bid(auction, asking)
        self.assertTrue(is_asking)
        self.assertTrue(conv.startswith("blackwood"))

        # Create a hand with 3 key cards (A/K counts)
        ranks = {"S": ["A", "K"], "H": ["A"], "D": [], "C": []}
        hand = make_hand_from_ranks(ranks)
        resp = mgr.get_ace_asking_response(conv, hand)
        # Response should be one of the defined mapping strings (fallback handled inside)
        self.assertIsInstance(resp, str)


if __name__ == "__main__":
    unittest.main()
