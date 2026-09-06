// server/ai.js
// Smart SAYC (Standard American Yellow Card) Bridge AI Bot for bidding and play
// Integrated with Python SAYC Bidding System (rajnesh/bridge-bidding-system)

import {
  SUITS,
  SEATS,
  PARTNERSHIPS,
  calculateHCP,
  isValidBid,
  getLegalPlays,
  nextSeat
} from './gameEngine.js';

import { getSaycBotBid, getSaycBotBidSync } from './biddingClient.js';

function getSuitLengths(hand) {
  const lengths = { S: 0, H: 0, D: 0, C: 0 };
  for (const card of hand) {
    lengths[card.suit]++;
  }
  return lengths;
}

function getBestSuit(lengths) {
  const sorted = Object.entries(lengths).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

// Built-in JavaScript heuristic fallback
export function generateBotBidFallback(hand, biddingHistory, botSeat) {
  const hcp = calculateHCP(hand);
  const lengths = getSuitLengths(hand);
  const nonPassBids = biddingHistory.filter(b => b.bid !== 'P');
  const lastBidObj = nonPassBids.length > 0 ? nonPassBids[nonPassBids.length - 1] : null;

  if (!lastBidObj) {
    if (hcp >= 12) {
      if (lengths.S >= 5) return '1S';
      if (lengths.H >= 5) return '1H';
    }

    if (hcp >= 15 && hcp <= 17 && Object.values(lengths).every(l => l >= 2)) {
      return '1NT';
    }

    if (hcp >= 12) {
      if (lengths.D >= 4) return '1D';
      if (lengths.C >= 3) return '1C';
      return '1C';
    }

    if (hcp >= 6 && hcp <= 10) {
      for (const suit of ['S', 'H', 'D', 'C']) {
        if (lengths[suit] >= 7) return `3${suit}`;
      }
    }
    return 'P';
  }

  const partnerSeat = { N: 'S', S: 'N', E: 'W', W: 'E' }[botSeat];
  const partnerBids = biddingHistory.filter(b => b.seat === partnerSeat && b.bid !== 'P');
  const lastPartnerBid = partnerBids.length > 0 ? partnerBids[partnerBids.length - 1] : null;

  if (lastPartnerBid && isValidBid('P', biddingHistory, botSeat)) {
    const partnerSuit = lastPartnerBid.bid.slice(1);
    const partnerLevel = parseInt(lastPartnerBid.bid[0], 10);

    if (SUITS.includes(partnerSuit) && lengths[partnerSuit] >= 3 && hcp >= 6) {
      const raiseLevel = partnerLevel + (hcp >= 10 ? 2 : 1);
      if (raiseLevel <= 4) {
        const potentialBid = `${raiseLevel}${partnerSuit}`;
        if (isValidBid(potentialBid, biddingHistory, botSeat)) {
          return potentialBid;
        }
      }
    }
  }

  if (hcp >= 12) {
    const bestSuit = getBestSuit(lengths);
    if (lengths[bestSuit] >= 5) {
      for (let level = 1; level <= 4; level++) {
        const bid = `${level}${bestSuit}`;
        if (isValidBid(bid, biddingHistory, botSeat)) {
          return bid;
        }
      }
    }
  }

  return 'P';
}

/**
 * Detailed asynchronous SAYC bot bidding with convention recognition.
 */
export async function generateBotBidDetailed(hand, biddingHistory, botSeat, dealer = 'N', vulnerability = null) {
  try {
    const saycResult = await getSaycBotBid(hand, biddingHistory, botSeat, dealer, vulnerability);
    if (saycResult && saycResult.bid && isValidBid(saycResult.bid, biddingHistory, botSeat)) {
      return {
        bid: saycResult.bid,
        convention: saycResult.convention || null
      };
    }
  } catch (err) {
    console.warn('[ai.js] SAYC engine query failed, falling back to JS heuristic:', err.message);
  }

  const fallbackBid = generateBotBidFallback(hand, biddingHistory, botSeat);
  return { bid: fallbackBid, convention: null };
}

/**
 * Detailed synchronous SAYC bot bidding with convention recognition.
 */
export function generateBotBidDetailedSync(hand, biddingHistory, botSeat, dealer = 'N', vulnerability = null) {
  try {
    const saycResult = getSaycBotBidSync(hand, biddingHistory, botSeat, dealer, vulnerability);
    if (saycResult && saycResult.bid && isValidBid(saycResult.bid, biddingHistory, botSeat)) {
      return {
        bid: saycResult.bid,
        convention: saycResult.convention || null
      };
    }
  } catch (err) {
    console.warn('[ai.js] SAYC sync query failed, falling back to JS heuristic:', err.message);
  }

  const fallbackBid = generateBotBidFallback(hand, biddingHistory, botSeat);
  return { bid: fallbackBid, convention: null };
}

/**
 * Primary bot bid generator returning the bid token string.
 * Preserves backwards compatibility with existing synchronous callers.
 */
export function generateBotBid(hand, biddingHistory, botSeat, dealer = 'N', vulnerability = null) {
  const result = generateBotBidDetailedSync(hand, biddingHistory, botSeat, dealer, vulnerability);
  return result.bid;
}

export function generateBotPlay(hand, currentTrick, ledSuit, trumpSuit, dummyHand, isDeclarerControl) {
  const legalPlays = getLegalPlays(hand, currentTrick, ledSuit);
  if (legalPlays.length === 0) return null;

  if (currentTrick.length === 0) {
    const sorted = [...legalPlays].sort((a, b) => b.rank - a.rank);
    return sorted[0];
  }

  const suitCards = legalPlays.filter(c => c.suit === ledSuit);
  if (suitCards.length > 0) {
    if (currentTrick.length === 1) {
      return suitCards[suitCards.length - 1];
    } else if (currentTrick.length === 2) {
      return suitCards[0];
    }
    return suitCards[suitCards.length - 1];
  }

  if (trumpSuit && trumpSuit !== 'NT') {
    const trumpCards = legalPlays.filter(c => c.suit === trumpSuit);
    if (trumpCards.length > 0) {
      const sortedTrumps = [...trumpCards].sort((a, b) => a.rank - b.rank);
      return sortedTrumps[0];
    }
  }

  const sortedOther = [...legalPlays].sort((a, b) => a.rank - b.rank);
  return sortedOther[0];
}
