"""Tests for competitive bidding conventions."""

from bridge_types import Auction, Bid, Card, Hand
from sayc_system import SAYCBiddingSystem


def make_test_hand(spades, hearts, diamonds, clubs, hcp=10):
    """Create a test hand with specified suit lengths and HCP."""
    # Start with all 2s
    hand = {
        "S": ["2"] * spades,
        "H": ["2"] * hearts,
        "D": ["2"] * diamonds,
        "C": ["2"] * clubs,
    }

    # Add high cards to match HCP
    suits = ["S", "H", "D", "C"]
    remaining_hcp = hcp
    i = 0
    while remaining_hcp > 0 and i < len(suits):
        if len(hand[suits[i]]) > 0:
            # Try to use A first (4 HCP)
            if remaining_hcp >= 4:
                hand[suits[i]][0] = "A"
                remaining_hcp -= 4
            # Then K (3 HCP)
            elif remaining_hcp >= 3:
                hand[suits[i]][0] = "K"
                remaining_hcp -= 3
            # Then Q (2 HCP)
            elif remaining_hcp >= 2:
                hand[suits[i]][0] = "Q"
                remaining_hcp -= 2
            # Finally J (1 HCP)
            elif remaining_hcp >= 1:
                hand[suits[i]][0] = "J"
                remaining_hcp -= 1
        i += 1

    return Hand({s: [Card(rank=r, suit=s) for r in ranks] for s, ranks in hand.items()})


def test_meckwell():
    """Test Meckwell defense over 1NT."""
    system = SAYCBiddingSystem()
    # Disable DONT and enable only Meckwell
    system.conventions.config.setdefault("notrump_defenses", {})["dont"] = {
        "enabled": False
    }
    system.conventions.config.setdefault("notrump_defenses", {})["meckwell"] = {
        "enabled": True,
        "direct_only": True,
    }
    system.start_auction("N")

    # Test case 1: Single suited hand for 2♣
    system.current_auction = Auction([Bid("1NT")])
    hand = make_test_hand(6, 2, 2, 3, hcp=10)  # 6-card spade suit
    bid = system.get_bid(hand)
    assert bid.token == "2C"  # Shows single-suited hand

    # Test case 2: Both majors for 2♦
    system.current_auction = Auction([Bid("1NT")])
    hand = make_test_hand(4, 4, 3, 2, hcp=10)  # 4-4 in majors
    bid = system.get_bid(hand)
    assert bid.token == "2D"  # Shows both majors


def test_support_doubles():
    """Test Support Doubles after interference."""
    system = SAYCBiddingSystem("tests/test_conventions.json")
    system.start_auction("N")

    # Test case 1: Support double showing 3-card heart support
    system.current_auction = Auction(
        [
            Bid("1D"),  # We open
            Bid("1S"),  # They overcall
            Bid("1H"),  # Partner responds
        ]
    )
    hand = make_test_hand(2, 3, 5, 3, hcp=13)  # 3-card heart support
    bid = system.get_bid(hand)
    assert bid.is_double  # Support double


def test_cue_bid_raises():
    """Test Cue bid raises in competition."""
    system = SAYCBiddingSystem("tests/test_conventions.json")
    system.start_auction("N")

    # Test case 1: Limit+ raise via cue bid
    system.current_auction = Auction(
        [
            Bid("1H"),  # We open
            Bid("1S"),  # They overcall
        ]
    )
    hand = make_test_hand(2, 4, 3, 4, hcp=11)  # 4-card heart support, 11 HCP
    bid = system.get_bid(hand)
    assert bid.token == "2S"  # Cue bid showing limit+ raise


def test_reopening_doubles():
    """Test Reopening Doubles after auction dies low."""
    system = SAYCBiddingSystem("tests/test_conventions.json")
    system.start_auction("N")

    # Test case 1: Reopening double in balancing seat
    system.current_auction = Auction(
        [
            Bid("1H"),  # They bid
            Bid("PASS"),  # Pass
            Bid("PASS"),  # Pass
        ]
    )
    hand = make_test_hand(3, 2, 4, 4, hcp=10)  # 10 HCP, support for unbid suits
    bid = system.get_bid(hand)
    assert bid.is_double  # Reopening double


def test_responsive_doubles():
    """Test Responsive Doubles after partner's takeout double."""
    system = SAYCBiddingSystem()
    system.start_auction("N")

    # Test case 1: Responsive double after partner's double
    system.current_auction = Auction(
        [
            Bid("1H"),  # They open
            Bid(None, is_double=True),  # Partner doubles
            Bid("2H"),  # They raise
        ]
    )
    hand = make_test_hand(3, 2, 4, 4, hcp=8)  # 8 HCP, support for unbid suits
    bid = system.get_bid(hand)
    assert bid.is_double  # Responsive double
