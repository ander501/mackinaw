// src/components/Table.jsx
import React, { useState, useEffect } from 'react';
import Hand from './Hand';
import BiddingBox from './BiddingBox';
import BiddingTable from './BiddingTable';
import { getLegalPlays } from '../engine/bridgeLogic';
import { User, Bot, History, X, Settings } from 'lucide-react';

const SEATS = ['N', 'E', 'S', 'W'];
const SEAT_NAMES = { N: 'North', E: 'East', S: 'South', W: 'West' };
const SUIT_SYMBOLS = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };

export default function Table({
  roomState,
  socket,
  onPlaceBid,
  onPlayCard,
  onAddBot,
  onRemoveBot,
  onClaimSeat
}) {
  const [showLastTrickModal, setShowLastTrickModal] = useState(false);
  const [showBiddingTableModal, setShowBiddingTableModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Table setting for auto-clearing previous trick (default 1.5 seconds = 1500 ms)
  const [clearDelayMs, setClearDelayMs] = useState(() => {
    const saved = localStorage.getItem('bridge_clear_delay_ms');
    return saved !== null ? Number(saved) : 1500;
  });

  const [visiblePreviousTrick, setVisiblePreviousTrick] = useState(null);

  const {
    seats,
    currentTurn,
    gameState,
    hands,
    dealer,
    contract,
    currentTrick,
    lastCompletedTrick,
    biddingHistory,
    tricksWon,
    ledSuit,
    mySeat,
    isSpectator
  } = roomState;

  // Auto-clear previous trick after configured delay (e.g. 1.5s)
  useEffect(() => {
    if (currentTrick && currentTrick.length > 0) {
      setVisiblePreviousTrick(null);
    } else if (lastCompletedTrick) {
      setVisiblePreviousTrick(lastCompletedTrick);

      if (clearDelayMs > 0) {
        const timer = setTimeout(() => {
          setVisiblePreviousTrick(null);
        }, clearDelayMs);
        return () => clearTimeout(timer);
      }
    } else {
      setVisiblePreviousTrick(null);
    }
  }, [currentTrick, lastCompletedTrick, clearDelayMs]);

  const handleUpdateDelaySetting = (newDelayMs) => {
    setClearDelayMs(newDelayMs);
    localStorage.setItem('bridge_clear_delay_ms', String(newDelayMs));
  };

  const isBiddingPhase = gameState === 'BIDDING';
  const isPlayingPhase = gameState === 'PLAYING';
  const declarer = contract ? contract.declarer : null;
  const dummy = contract ? contract.dummy : null;
  const trumpSuit = contract ? contract.suit : null;

  // Calculate legal cards for the hand currently to play
  const currentHandCards = hands[currentTurn] && Array.isArray(hands[currentTurn]) ? hands[currentTurn] : [];
  const currentLegalCards = getLegalPlays(currentHandCards, currentTrick, ledSuit);

  const isDisplayingPreviousTrick = currentTrick.length === 0 && visiblePreviousTrick;
  const displayCards = isDisplayingPreviousTrick ? visiblePreviousTrick.trick : currentTrick;

  // Turn guidance text
  let turnGuidanceText = '';
  if (isPlayingPhase) {
    if (currentTurn === dummy) {
      if (declarer === mySeat) {
        turnGuidanceText = `★ Your Turn to Play (from Dummy's Hand - ${SEAT_NAMES[dummy]})`;
      } else {
        turnGuidanceText = `Turn to Play: ${SEAT_NAMES[dummy]} (Dummy - Played by ${SEAT_NAMES[declarer]})`;
      }
    } else if (currentTurn === mySeat) {
      turnGuidanceText = `★ Your Turn to Play (${SEAT_NAMES[mySeat]})`;
    } else {
      turnGuidanceText = `Turn to Play: ${SEAT_NAMES[currentTurn]}`;
    }
  } else if (isBiddingPhase) {
    if (currentTurn === mySeat) {
      turnGuidanceText = `★ Your Turn to Bid (${SEAT_NAMES[mySeat]})`;
    } else {
      turnGuidanceText = `Turn to Bid: ${SEAT_NAMES[currentTurn]}`;
    }
  }

  return (
    <div className="table-viewport">
      <div className="felt-table">
        {/* Top Control Bar inside Table */}
        <div style={{ position: 'absolute', top: '15px', right: '25px', zIndex: 10, display: 'flex', gap: '8px' }}>
          <button
            className="nav-btn"
            style={{ background: 'rgba(11, 19, 30, 0.85)', borderColor: '#e5c158', color: '#e5c158', fontSize: '0.8rem' }}
            onClick={() => setShowSettingsModal(true)}
            title="Table Settings"
          >
            <Settings size={14} /> Settings
          </button>

          {biddingHistory.length > 0 && (
            <button
              className="nav-btn"
              style={{ background: 'rgba(11, 19, 30, 0.85)', borderColor: '#e5c158', color: '#e5c158', fontSize: '0.8rem' }}
              onClick={() => setShowBiddingTableModal(true)}
            >
              📋 Bidding Table
            </button>
          )}

          {lastCompletedTrick && (
            <button
              className="nav-btn"
              style={{ background: 'rgba(11, 19, 30, 0.85)', borderColor: '#e5c158', color: '#e5c158', fontSize: '0.8rem' }}
              onClick={() => setShowLastTrickModal(true)}
            >
              <History size={14} /> View Last Trick
            </button>
          )}
        </div>

        {/* Active Turn Header Banner */}
        {turnGuidanceText && (
          <div
            style={{
              position: 'absolute',
              top: '15px',
              left: '25px',
              zIndex: 10,
              background: (currentTurn === mySeat || (currentTurn === dummy && declarer === mySeat))
                ? 'linear-gradient(135deg, rgba(229, 193, 88, 0.95), rgba(217, 119, 6, 0.95))'
                : 'rgba(11, 19, 30, 0.85)',
              color: (currentTurn === mySeat || (currentTurn === dummy && declarer === mySeat)) ? '#0b131e' : '#e5c158',
              border: '1px solid #e5c158',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: '800',
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              letterSpacing: '0.3px'
            }}
          >
            {turnGuidanceText}
          </div>
        )}

        {/* Tricks Taken Piles (NS and EW) */}
        {isPlayingPhase && (
          <>
            {/* NS Tricks Stack */}
            <div
              style={{
                position: 'absolute',
                bottom: '160px',
                left: '220px',
                zIndex: 8,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(11, 19, 30, 0.85)',
                border: '1px solid var(--glass-border)',
                padding: '6px 12px',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ display: 'flex', position: 'relative', width: '32px', height: '42px' }}>
                {Array.from({ length: Math.min(tricksWon.NS, 6) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${i * 3}px`,
                      top: `${i * 2}px`,
                      width: '24px',
                      height: '34px',
                      background: '#1e293b',
                      border: '1px solid #e5c158',
                      borderRadius: '3px'
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e5c158' }}>
                NS: {tricksWon.NS} {tricksWon.NS === 1 ? 'Trick' : 'Tricks'}
              </div>
            </div>

            {/* EW Tricks Stack */}
            <div
              style={{
                position: 'absolute',
                bottom: '160px',
                right: '220px',
                zIndex: 8,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(11, 19, 30, 0.85)',
                border: '1px solid var(--glass-border)',
                padding: '6px 12px',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ display: 'flex', position: 'relative', width: '32px', height: '42px' }}>
                {Array.from({ length: Math.min(tricksWon.EW, 6) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${i * 3}px`,
                      top: `${i * 2}px`,
                      width: '24px',
                      height: '34px',
                      background: '#1e293b',
                      border: '1px solid #3b82f6',
                      borderRadius: '3px'
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#3b82f6' }}>
                EW: {tricksWon.EW} {tricksWon.EW === 1 ? 'Trick' : 'Tricks'}
              </div>
            </div>
          </>
        )}

        {/* Render 4 Seats */}
        {SEATS.map((seatKey) => {
          const seatObj = seats[seatKey];
          const isTurn = currentTurn === seatKey;
          const isDealer = dealer === seatKey;
          const isDummy = isPlayingPhase && dummy === seatKey;
          const isDeclarerSeat = isPlayingPhase && declarer === seatKey;

          let canIPlayThisHand = false;
          if (isPlayingPhase && isTurn) {
            if (seatKey === mySeat) {
              canIPlayThisHand = true;
            } else if (isDummy && declarer === mySeat) {
              canIPlayThisHand = true;
            } else if (declarer && dummy && seats[declarer] && seats[declarer].isBot && mySeat === dummy) {
              canIPlayThisHand = true;
            }
          }

          return (
            <div key={seatKey} className={`seat-box seat-${seatKey} ${isTurn ? 'turn-highlight' : ''}`}>
              <div className={`player-badge ${isTurn ? 'active-turn' : ''}`}>
                <span className="seat-label">
                  {SEAT_NAMES[seatKey]} {isDealer ? '(Dealer)' : ''} {isDeclarerSeat ? '(Declarer)' : ''} {isDummy ? '(Dummy)' : ''}
                </span>

                {seatObj ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {seatObj.isBot ? <Bot size={14} color="#e5c158" /> : <User size={14} color="#3b82f6" />}
                    <span className="player-name">{seatObj.name}</span>
                    {seatObj.isBot && isSpectator && (
                      <button
                        onClick={() => onRemoveBot(seatKey)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="claim-seat-btn" onClick={() => onClaimSeat(seatKey)}>
                      Sit Here
                    </button>
                    <button className="claim-seat-btn" style={{ borderColor: '#3b82f6', color: '#3b82f6' }} onClick={() => onAddBot(seatKey)}>
                      + Bot
                    </button>
                  </div>
                )}
              </div>

              {/* Turn Indicator Label above hand */}
              {isTurn && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: canIPlayThisHand ? '#e5c158' : '#3b82f6',
                    fontWeight: '800',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {canIPlayThisHand
                    ? (isDummy ? '★ YOUR TURN (PLAY DUMMY)' : '★ YOUR TURN TO PLAY')
                    : `★ ${SEAT_NAMES[seatKey]}'S TURN`}
                </div>
              )}

              <Hand
                cards={hands[seatKey]}
                isMyTurn={canIPlayThisHand}
                legalPlays={canIPlayThisHand ? currentLegalCards : []}
                onPlayCard={onPlayCard}
                isDummyExposed={isDummy}
                seatKey={seatKey}
                trumpSuit={trumpSuit}
              />
            </div>
          );
        })}

        {/* Center Table Area */}
        <div className="table-center">
          {contract && (
            <div className="contract-badge">
              Contract: {contract.bid} by {SEAT_NAMES[contract.declarer]} {contract.multiplier === 2 ? '(X)' : contract.multiplier === 4 ? '(XX)' : ''}
            </div>
          )}

          <div className="trick-surface">
            {displayCards.map((play, idx) => (
              <div key={idx} className={`trick-card played-${play.seat}`}>
                <div
                  className={`card-item ${play.card.suit === 'H' || play.card.suit === 'D' ? 'card-red' : 'card-black'}`}
                  style={{ width: '48px', height: '70px', padding: '4px', fontSize: '0.75rem' }}
                >
                  <div className="card-top">
                    <span className="card-rank">{play.card.name}</span>
                    <span className="card-suit-sm">{SUIT_SYMBOLS[play.card.suit]}</span>
                  </div>
                  <div className="card-center-suit" style={{ fontSize: '1.1rem' }}>
                    {SUIT_SYMBOLS[play.card.suit]}
                  </div>
                </div>
              </div>
            ))}

            {isDisplayingPreviousTrick && visiblePreviousTrick && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '-30px',
                  background: 'rgba(11, 19, 30, 0.95)',
                  border: '1px solid #e5c158',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  color: '#e5c158',
                  fontWeight: '700',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                }}
              >
                Previous Trick won by {SEAT_NAMES[visiblePreviousTrick.winner]}
              </div>
            )}

            {displayCards.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.25)', fontSize: '0.85rem' }}>
                {isBiddingPhase ? 'Bidding Phase in progress...' : 'Lead card to start trick'}
              </div>
            )}
          </div>
        </div>

        {/* Bidding Box Overlay */}
        {isBiddingPhase && (
          <BiddingBox
            isMyTurn={currentTurn === mySeat}
            biddingHistory={biddingHistory}
            onPlaceBid={onPlaceBid}
            mySeat={mySeat}
          />
        )}
      </div>

      {/* Table Settings Modal */}
      {showSettingsModal && (
        <div className="modal-backdrop" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: '800', color: '#e5c158', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} /> TABLE SETTINGS
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0', marginBottom: '8px' }}>
                Previous Trick Auto-Clear Delay
              </label>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '12px' }}>
                Controls how long completed trick cards remain displayed on table center before clearing automatically.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: '1.5 Seconds (Default)', value: 1500 },
                  { label: '3.0 Seconds', value: 3000 },
                  { label: 'Instant (0.5s)', value: 500 },
                  { label: 'Keep Until Next Card Led (Manual)', value: -1 }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleUpdateDelaySetting(option.value)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: clearDelayMs === option.value ? '2px solid #e5c158' : '1px solid var(--glass-border)',
                      background: clearDelayMs === option.value ? 'rgba(229, 193, 88, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                      color: clearDelayMs === option.value ? '#e5c158' : '#cbd5e1',
                      fontWeight: clearDelayMs === option.value ? '700' : '500',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{option.label}</span>
                    {clearDelayMs === option.value && <span>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <button className="copy-btn" style={{ width: '100%', padding: '10px' }} onClick={() => setShowSettingsModal(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Bidding Table Modal */}
      {showBiddingTableModal && (
        <div className="modal-backdrop" onClick={() => setShowBiddingTableModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: '800', color: '#e5c158' }}>
                BIDDING HISTORY
              </div>
              <button onClick={() => setShowBiddingTableModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <BiddingTable biddingHistory={biddingHistory} dealer={dealer} />

            <button className="copy-btn" style={{ width: '100%', marginTop: '14px', padding: '10px' }} onClick={() => setShowBiddingTableModal(false)}>
              Close Table
            </button>
          </div>
        </div>
      )}

      {/* View Last Trick Inspector Modal */}
      {showLastTrickModal && lastCompletedTrick && (
        <div className="modal-backdrop" onClick={() => setShowLastTrickModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: '800', color: '#e5c158' }}>
                LAST TRICK TAKEN
              </div>
              <button onClick={() => setShowLastTrickModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '0.88rem', color: '#cbd5e1' }}>
              Won by <strong>{SEAT_NAMES[lastCompletedTrick.winner]}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
              {lastCompletedTrick.trick.map((play, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <div className="seat-label" style={{ fontSize: '0.75rem' }}>{SEAT_NAMES[play.seat]}</div>
                  <div
                    className={`card-item ${play.card.suit === 'H' || play.card.suit === 'D' ? 'card-red' : 'card-black'}`}
                    style={{ width: '54px', height: '80px', padding: '4px', position: 'relative' }}
                  >
                    <div className="card-top">
                      <span className="card-rank">{play.card.name}</span>
                      <span className="card-suit-sm">{SUIT_SYMBOLS[play.card.suit]}</span>
                    </div>
                    <div className="card-center-suit" style={{ fontSize: '1.2rem' }}>
                      {SUIT_SYMBOLS[play.card.suit]}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="copy-btn" style={{ width: '100%', padding: '10px' }} onClick={() => setShowLastTrickModal(false)}>
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
