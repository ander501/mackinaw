// server/ai.js
// Smart SAYC (Standard American Yellow Card) Bridge AI Bot for bidding and play

import {
  SUITS,
  SEATS,
  PARTNERSHIPS,
  calculateHCP,
  isValidBid,
  getLegalPlays,
  nextSeat
} from './gameEngine.js';

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

export function generateBotBid(hand, biddingHistory, botSeat) {
  const hcp = calculateHCP(hand);
  const lengths = getSuitLengths(hand);
  const nonPassBids = biddingHistory.filter(b => b.bid !== 'P');
  const lastBidObj = nonPassBids.length > 0 ? nonPassBids[nonPassBids.length - 1] : null;

  if (!lastBidObj) {
    // Standard SAYC: 5-card major opening takes priority with 12+ HCP
    if (hcp >= 12) {
      if (lengths.S >= 5) return '1S';
      if (lengths.H >= 5) return '1H';
    }

    // Balanced 15-17 HCP No Trump opening
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
    const trumps = legalPlays.filter(c => c.suit === trumpSuit);
    if (trumps.length > 0) {
      return trumps[trumps.length - 1];
    }
  }

  const sortedByRank = [...legalPlays].sort((a, b) => a.rank - b.rank);
  return sortedByRank[0];
}
