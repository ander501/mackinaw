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
