// src/components/BiddingBox.jsx
import React from 'react';

const SUITS = ['C', 'D', 'H', 'S', 'NT'];
const SUIT_SYMBOLS = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };

export default function BiddingBox({ isMyTurn, biddingHistory, onPlaceBid, mySeat }) {
  if (!isMyTurn) {
    return null;
  }

  // Generate 1-7 level bids
  const levels = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="bidding-modal">
      <div style={{ textAlign: 'center', fontWeight: '800', color: '#e5c158', fontSize: '0.9rem' }}>
        YOUR TURN TO BID
      </div>

      <div className="bidding-grid">
        {levels.map(level =>
          SUITS.map(suit => {
            const bidStr = `${level}${suit}`;
            const isRed = suit === 'H' || suit === 'D';
            return (
              <button
                key={bidStr}
                className="bid-btn"
                style={{ color: isRed ? '#ef4444' : suit === 'NT' ? '#e5c158' : '#f8fafc' }}
                onClick={() => onPlaceBid(bidStr)}
              >
                {level}{SUIT_SYMBOLS[suit]}
              </button>
            );
          })
        )}
      </div>

      <div className="special-bids">
        <button className="pass-btn" onClick={() => onPlaceBid('P')}>
          PASS
        </button>
        <button className="double-btn" onClick={() => onPlaceBid('X')}>
          DOUBLE (X)
        </button>
        <button className="double-btn" style={{ background: '#7c3aed' }} onClick={() => onPlaceBid('XX')}>
          REDOUBLE (XX)
        </button>
      </div>
    </div>
  );
}
