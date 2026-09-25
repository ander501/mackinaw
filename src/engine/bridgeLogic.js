// src/engine/bridgeLogic.js
// Shared Bridge rules and legal play helpers for client UI & server

export function getLegalPlays(hand, currentTrick = [], ledSuit = null) {
  if (!Array.isArray(hand) || hand.length === 0) return [];
  if (!ledSuit || !currentTrick || currentTrick.length === 0) return hand;

  const sameSuitCards = hand.filter(c => c.suit === ledSuit);
  if (sameSuitCards.length > 0) {
    return sameSuitCards;
  }
  return hand;
}

const PARTNERSHIPS = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' };

export function getBidValue(bid) {
  if (['P', 'Pass', 'X', 'XX'].includes(bid)) return 0;
  const level = parseInt(bid[0], 10);
  const suit = bid.slice(1);
  const suitVal = { C: 1, D: 2, H: 3, S: 4, NT: 5 }[suit];
  return (level - 1) * 5 + suitVal;
}

export function isValidBid(bid, biddingHistory = [], playerSeat = null) {
  const nonPassBids = biddingHistory.filter(b => b.bid !== 'P' && b.bid !== 'Pass');
  const lastNonPass = nonPassBids.length > 0 ? nonPassBids[nonPassBids.length - 1] : null;

  if (bid === 'P' || bid === 'Pass') return true;

  if (bid === 'X') {
    if (!lastNonPass) return false;
    if (lastNonPass.bid === 'X' || lastNonPass.bid === 'XX') return false;
    if (!playerSeat) return true;
    return PARTNERSHIPS[lastNonPass.seat] !== PARTNERSHIPS[playerSeat];
  }

  if (bid === 'XX') {
    if (!lastNonPass) return false;
    if (lastNonPass.bid !== 'X') return false;
    if (!playerSeat) return true;
    return PARTNERSHIPS[lastNonPass.seat] !== PARTNERSHIPS[playerSeat];
  }

  const newValue = getBidValue(bid);
  const lastContractBid = biddingHistory.slice().reverse().find(b => !['P', 'Pass', 'X', 'XX'].includes(b.bid));
  if (!lastContractBid) return true;

  const lastValue = getBidValue(lastContractBid.bid);
  return newValue > lastValue;
}
