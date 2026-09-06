#!/usr/bin/env python3
"""
Service script providing an IPC interface for the SAYC bridge bidding system.
Supports both one-shot CLI execution and persistent daemon mode via stdio.
"""

import os
import sys
import json

# Ensure bidding_system directory is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from bridge_types import Card, Hand, Bid
from sayc_system import SAYCBiddingSystem

RANK_MAP = {
    14: "A",
    13: "K",
    12: "Q",
    11: "J",
    10: "10",
    9: "9",
    8: "8",
    7: "7",
    6: "6",
    5: "5",
    4: "4",
    3: "3",
    2: "2"
}

def parse_card(raw_card):
    suit = raw_card.get("suit")
    rank = raw_card.get("rank")
    if isinstance(rank, int):
        rank_str = RANK_MAP.get(rank, str(rank))
    elif isinstance(rank, str):
        rank_str = rank.upper()
        if rank_str == "14":
            rank_str = "A"
        elif rank_str == "13":
            rank_str = "K"
        elif rank_str == "12":
            rank_str = "Q"
        elif rank_str == "11":
            rank_str = "J"
    else:
        rank_str = "2"
    return Card(rank=rank_str, suit=suit)

def build_hand(cards_list):
    buckets = {"S": [], "H": [], "D": [], "C": []}
    for c in cards_list:
        card = parse_card(c)
        if card.suit in buckets:
            buckets[card.suit].append(card)
    return Hand(buckets)

def process_bidding_request(data):
    req_id = data.get("id")
    raw_hand = data.get("hand", [])
    bidding_history = data.get("biddingHistory", [])
    dealer = data.get("dealer", "N")
    bot_seat = data.get("botSeat", "N")
    vul = data.get("vulnerability", {})
    vul_we = bool(vul.get("we", False))
    vul_they = bool(vul.get("they", False))

    hand = build_hand(raw_hand)

    system = SAYCBiddingSystem()
    system.start_auction_with_dealer(
        our_seat=bot_seat,
        dealer=dealer,
        vul_we=vul_we,
        vul_they=vul_they
    )

    for item in bidding_history:
        raw_token = item.get("bid")
        seat = item.get("seat")
        if raw_token in ("P", "Pass", "PASS", None):
            b = Bid(None, seat=seat)
        elif raw_token in ("X", "Double", "DOUBLE"):
            b = Bid(None, is_double=True, seat=seat)
        elif raw_token in ("XX", "Redouble", "REDOUBLE"):
            b = Bid(None, is_redouble=True, seat=seat)
        else:
            b = Bid(raw_token, seat=seat)
        system.current_auction.bids.append(b)

    result_bid = system.get_bid(hand)

    if getattr(result_bid, "is_redouble", False):
        bid_str = "XX"
    elif getattr(result_bid, "is_double", False):
        bid_str = "X"
    elif result_bid.token:
        bid_str = result_bid.token
    else:
        bid_str = "P"

    convention = getattr(result_bid, "convention_used", None)

    return {
        "id": req_id,
        "bid": bid_str,
        "convention": convention,
        "success": True
    }

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--daemon":
        # Daemon mode reading line-delimited JSON from stdin
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                response = process_bidding_request(data)
            except Exception as e:
                response = {"id": None, "bid": "P", "error": str(e), "success": False}
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
    elif len(sys.argv) > 1:
        # CLI one-shot mode with JSON string argument
        try:
            data = json.loads(sys.argv[1])
            response = process_bidding_request(data)
        except Exception as e:
            response = {"id": None, "bid": "P", "error": str(e), "success": False}
        print(json.dumps(response))
    else:
        # Read single JSON from stdin
        content = sys.stdin.read().strip()
        if content:
            try:
                data = json.loads(content)
                response = process_bidding_request(data)
            except Exception as e:
                response = {"id": None, "bid": "P", "error": str(e), "success": False}
            print(json.dumps(response))

if __name__ == "__main__":
    main()
