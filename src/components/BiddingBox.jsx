// src/components/BiddingBox.jsx
import React from 'react';
import { isValidBid } from '../engine/bridgeLogic';

const SUITS = ['C', 'D', 'H', 'S', 'NT'];
const SUIT_SYMBOLS = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };
const SEAT_NAMES = { N: 'North', E: 'East', S: 'South', W: 'West' };

export default function BiddingBox({
  isMyTurn,
  biddingHistory = [],
  onPlaceBid,
  mySeat,
  currentTurn,
  seats
}) {
  const levels = [1, 2, 3, 4, 5, 6, 7];

  // Check eligibility for special bids
  const canPass = isValidBid('P', biddingHistory, mySeat);
  const canDouble = isValidBid('X', biddingHistory, mySeat);
  const canRedouble = isValidBid('XX', biddingHistory, mySeat);

  // Filter levels that have at least one eligible bid
  const eligibleLevels = levels.filter(level =>
    SUITS.some(suit => isValidBid(`${level}${suit}`, biddingHistory, mySeat))
  );

  const turnPlayerName = seats && seats[currentTurn] ? seats[currentTurn].name : (SEAT_NAMES[currentTurn] || currentTurn);

  return (
    <div className={`bidding-box-sidebar ${isMyTurn ? 'my-turn' : 'waiting-turn'}`}>
      {/* Header Banner */}
      <div className="bidding-box-header">
        {isMyTurn ? (
          <div className="bidding-turn-active">
            <span className="bidding-glow-dot" />
            <span>★ YOUR TURN TO BID {mySeat ? `(${SEAT_NAMES[mySeat]})` : ''}</span>
          </div>
        ) : (
          <div className="bidding-turn-waiting">
            <span>Turn: {turnPlayerName} ({SEAT_NAMES[currentTurn]})</span>
          </div>
        )}
      </div>

      {/* Special Calls (Pass, Double, Redouble) */}
      <div className="bidding-special-bar">
        {canPass && (
          <button
            className="special-bid-btn pass-btn"
            disabled={!isMyTurn}
            onClick={() => onPlaceBid('P')}
            title="Pass"
          >
            PASS
          </button>
        )}
        {canDouble && (
          <button
            className="special-bid-btn double-btn"
            disabled={!isMyTurn}
            onClick={() => onPlaceBid('X')}
            title="Double opponent contract"
          >
            DOUBLE (X)
          </button>
        )}
        {canRedouble && (
          <button
            className="special-bid-btn redouble-btn"
            disabled={!isMyTurn}
            onClick={() => onPlaceBid('XX')}
            title="Redouble"
          >
            REDOUBLE (XX)
          </button>
        )}
      </div>

      {/* Suit Column Headers */}
      {eligibleLevels.length > 0 && (
        <div className="bidding-suits-header">
          <span className="suit-col-header">♣</span>
          <span className="suit-col-header red">♦</span>
          <span className="suit-col-header red">♥</span>
          <span className="suit-col-header">♠</span>
          <span className="suit-col-header nt">NT</span>
        </div>
      )}

      {/* Grid of Eligible Bids */}
      <div className="bidding-levels-container">
        {eligibleLevels.map(level => (
          <div key={level} className="bidding-level-row">
            {SUITS.map(suit => {
              const bidStr = `${level}${suit}`;
              const isEligible = isValidBid(bidStr, biddingHistory, mySeat);

              if (!isEligible) {
                return <div key={bidStr} className="bid-slot-empty" />;
              }

              const isRed = suit === 'H' || suit === 'D';
              return (
                <button
                  key={bidStr}
                  className={`bid-btn ${isRed ? 'bid-red' : suit === 'NT' ? 'bid-nt' : 'bid-black'}`}
                  disabled={!isMyTurn}
                  onClick={() => onPlaceBid(bidStr)}
                >
                  {level}{SUIT_SYMBOLS[suit]}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
