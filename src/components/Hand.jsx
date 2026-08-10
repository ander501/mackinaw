// src/components/Hand.jsx
import React from 'react';

const SUIT_SYMBOLS = { C: '♣', D: '♦', H: '♥', S: '♠' };

function groupCardsBySuit(cards) {
  const groups = { S: [], H: [], D: [], C: [] };
  if (Array.isArray(cards)) {
    cards.forEach((card) => {
      if (groups[card.suit]) {
        groups[card.suit].push(card);
      }
    });
  }
  // Sort descending rank in each suit
  for (const s in groups) {
    groups[s].sort((a, b) => b.rank - a.rank);
  }
  return groups;
}

function getSuitOrdering(trumpSuit, seatKey) {
  const allSuits = ['S', 'H', 'D', 'C'];
  const nonTrumps = allSuits.filter((s) => s !== trumpSuit);

  // Alternating colors for non-trumps (e.g. if nonTrumps has S, H, D, C, alternate red/black)
  let suitOrder = [];
  if (trumpSuit && trumpSuit !== 'NT' && allSuits.includes(trumpSuit)) {
    // Put Trump suit first
    suitOrder.push(trumpSuit);

    // Arrange remaining 3 suits in alternating colors
    const reds = nonTrumps.filter((s) => s === 'H' || s === 'D');
    const blacks = nonTrumps.filter((s) => s === 'S' || s === 'C');

    const trumpIsRed = trumpSuit === 'H' || trumpSuit === 'D';
    if (trumpIsRed) {
      if (blacks.length > 0) suitOrder.push(blacks[0]);
      if (reds.length > 0) suitOrder.push(reds[0]);
      if (blacks.length > 1) suitOrder.push(blacks[1]);
    } else {
      if (reds.length > 0) suitOrder.push(reds[0]);
      if (blacks.length > 0) suitOrder.push(blacks[0]);
      if (reds.length > 1) suitOrder.push(reds[1]);
    }
  } else {
    suitOrder = ['S', 'H', 'C', 'D']; // Alternating colors black, red, black, red
  }

  // Adjust direction so Trump is on Dummy's RIGHT:
  // North facing South -> Right is West (left of screen). So Trump on Left (index 0).
  // South facing North -> Right is East (right of screen). So reverse (Trump on Right).
  // East facing West -> Right is North (top of screen). So Trump on Top.
  // West facing East -> Right is South (bottom of screen). So reverse (Trump on Bottom).
  if (seatKey === 'S' || seatKey === 'W') {
    suitOrder.reverse();
  }

  return suitOrder;
}

export default function Hand({
  cards,
  isMyTurn,
  legalPlays = [],
  onPlayCard,
  isDummyExposed = false,
  seatKey = '',
  trumpSuit = null
}) {
  if (typeof cards === 'number') {
    // Face-down cards
    const count = cards;
    return (
      <div className="hand-container">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="card-item card-back"
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              marginLeft: idx === 0 ? 0 : '-32px'
            }}
          >
            <div style={{ fontSize: '1rem', color: '#e5c158', opacity: 0.4, textAlign: 'center', marginTop: '30px' }}>
              🂠
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return <div className="hand-container" style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No cards left</div>;
  }

  // SPECIAL DUMMY EXPOSED LAYOUT: Distinct columns (N/S) or rows (E/W) per suit!
  if (isDummyExposed) {
    const suitGroups = groupCardsBySuit(cards);
    const suitOrdering = getSuitOrdering(trumpSuit, seatKey);
    const isVerticalLayout = seatKey === 'N' || seatKey === 'S';

    return (
      <div
        className="dummy-hand-container"
        style={{
          display: 'flex',
          flexDirection: isVerticalLayout ? 'row' : 'column',
          gap: '12px',
          alignItems: 'center',
          justify: 'center',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--gold-accent)',
          borderRadius: '12px',
          padding: '8px 12px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.5)'
        }}
      >
        {suitOrdering.map((suit) => {
          const suitCards = suitGroups[suit];
          if (!suitCards || suitCards.length === 0) return null;

          const isRed = suit === 'H' || suit === 'D';

          return (
            <div
              key={suit}
              style={{
                display: 'flex',
                flexDirection: isVerticalLayout ? 'column' : 'row',
                alignItems: 'center',
                position: 'relative'
              }}
            >
              {suitCards.map((card, idx) => {
                const isPlayable = isMyTurn && legalPlays.some((c) => c.id === card.id);

                return (
                  <div
                    key={card.id}
                    className={`card-item ${isRed ? 'card-red' : 'card-black'} ${isPlayable ? 'playable' : 'disabled'}`}
                    style={{
                      width: '46px',
                      height: '68px',
                      padding: '3px',
                      fontSize: '0.75rem',
                      marginTop: isVerticalLayout && idx > 0 ? '-42px' : 0,
                      marginLeft: !isVerticalLayout && idx > 0 ? '-26px' : 0,
                      zIndex: idx + 1
                    }}
                    onClick={() => {
                      if (isPlayable && onPlayCard) {
                        onPlayCard(card.id);
                      }
                    }}
                  >
                    <div className="card-top">
                      <span className="card-rank">{card.name}</span>
                      <span className="card-suit-sm">{SUIT_SYMBOLS[card.suit]}</span>
                    </div>
                    <div className="card-center-suit" style={{ fontSize: '1rem' }}>
                      {SUIT_SYMBOLS[card.suit]}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Standard player hand
  return (
    <div className="hand-container">
      {cards.map((card, idx) => {
        const isRed = card.suit === 'H' || card.suit === 'D';
        const isPlayable = isMyTurn && legalPlays.some((c) => c.id === card.id);

        return (
          <div
            key={card.id}
            className={`card-item ${isRed ? 'card-red' : 'card-black'} ${isPlayable ? 'playable' : 'disabled'}`}
            style={{
              marginLeft: idx === 0 ? 0 : '-28px',
              zIndex: idx + 1
            }}
            onClick={() => {
              if (isPlayable && onPlayCard) {
                onPlayCard(card.id);
              }
            }}
          >
            <div className="card-top">
              <span className="card-rank">{card.name}</span>
              <span className="card-suit-sm">{SUIT_SYMBOLS[card.suit]}</span>
            </div>
            <div className="card-center-suit">{SUIT_SYMBOLS[card.suit]}</div>
          </div>
        );
      })}
    </div>
  );
}
