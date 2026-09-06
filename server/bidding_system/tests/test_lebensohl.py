from bridge_types import Auction, Bid, Hand
from sayc_system import SAYCBiddingSystem


def test_lebensohl_fast_denial():
    """Test Lebensohl fast denial showing stopper in opponents' suit."""
    system = SAYCBiddingSystem()
    system.start_auction("N")
    h = Hand("AQxx KQxx AQx Kx")  # 17 HCP with stopper in most suits
    system.current_auction = Auction(
        [
            Bid("1NT"),  # Our 1NT opening
            Bid("PASS"),
            Bid("2H"),  # Opponent's interference
        ]
    )

    # Test that with a heart stopper and game values, we bid 3NT directly
    next_bid = system.get_bid(h)
    assert next_bid.token == "3NT"


def test_lebensohl_slow_sequences():
    """Test Lebensohl slow sequences via 2NT puppet."""
    system = SAYCBiddingSystem()
    system.start_auction("N")
    h = Hand("xxx xxx QJ10xxx x")  # Weak hand with long diamonds
    system.current_auction = Auction(
        [
            Bid("1NT"),
            Bid("PASS"),
            Bid("2H"),  # Opponent's interference
        ]
    )

    # Test that weak hands go through 2NT
    next_bid = system.get_bid(h)
    assert next_bid.token == "2NT"


def test_lebensohl_stopper_asking():
    """Test Lebensohl stopper-asking sequences."""
    system = SAYCBiddingSystem()
    system.start_auction("N")
    # Strong hand without a spade stopper (spades are xxxx)
    h = Hand("xxxx AQxx AKx KQx")
    system.current_auction = Auction(
        [
            Bid("1NT"),
            Bid("PASS"),
            Bid("2S"),  # Opponent's interference showing spades
        ]
    )

    # Without a spade stopper, we should cue-bid spades
    next_bid = system.get_bid(h)
    assert next_bid.token == "3S"
