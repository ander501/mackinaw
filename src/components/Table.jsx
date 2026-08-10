// src/components/Table.jsx
import React, { useState } from 'react';
import Hand from './Hand';
import BiddingBox from './BiddingBox';
import BiddingTable from './BiddingTable';
import { getLegalPlays } from '../engine/bridgeLogic';
import { User, Bot, Eye, Play, History, X } from 'lucide-react';

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
  onClaimSeat,
  onContinueTrick
}) {
  const [showLastTrickModal, setShowLastTrickModal] = useState(false);
  const [showBiddingTableModal, setShowBiddingTableModal] = useState(false);

  const {
    seats,
    currentTurn,
    gameState,
    hands,
    dealer,
    contract,
    currentTrick,
    lastCompletedTrick,
    waitingForContinue,
    biddingHistory,
    tricksWon,
    ledSuit,
    mySeat,
    isSpectator,
    systemMessage
  } = roomState;

  const isBiddingPhase = gameState === 'BIDDING';
  const isPlayingPhase = gameState === 'PLAYING';
  const declarer = contract ? contract.declarer : null;
  const dummy = contract ? contract.dummy : null;
  const trumpSuit = contract ? contract.suit : null;

  // Is human allowed to act?
  let isMyTurnToAct = false;
  if (isBiddingPhase) {
    isMyTurnToAct = currentTurn === mySeat;
  } else if (isPlayingPhase) {
    if (currentTurn === mySeat) {
      isMyTurnToAct = true;
    } else if (currentTurn === dummy && declarer === mySeat) {
      // Declarer plays for Dummy on Dummy's turn!
      isMyTurnToAct = true;
    } else if (declarer && dummy && seats[declarer] && seats[declarer].isBot && mySeat === dummy) {
      // Human partner of Bot Declarer plays for Declarer or Dummy!
      if (currentTurn === declarer || currentTurn === dummy) {
        isMyTurnToAct = true;
      }
    }
  }

  // Calculate legal cards for the hand currently to play
  const currentHandCards = hands[currentTurn] && Array.isArray(hands[currentTurn]) ? hands[currentTurn] : [];
  const currentLegalCards = getLegalPlays(currentHandCards, currentTrick, ledSuit);

  const isDisplayingPreviousTrick = currentTrick.length === 0 && lastCompletedTrick;
  const displayCards = isDisplayingPreviousTrick ? lastCompletedTrick.trick : currentTrick;

  return (
    <div className="table-viewport">
      <div className="felt-table">
        {/* Top Control Bar inside Table */}
        <div style={{ position: 'absolute', top: '15px', right: '25px', zIndex: 10, display: 'flex', gap: '8px' }}>
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

          // Is it my turn to play THIS specific hand?
          let canIPlayThisHand = false;
          if (isPlayingPhase && isTurn) {
            if (seatKey === mySeat) {
              canIPlayThisHand = true;
            } else if (isDummy && declarer === mySeat) {
              // Declarer plays Dummy's hand on Dummy's turn!
              canIPlayThisHand = true;
            } else if (declarer && dummy && seats[declarer] && seats[declarer].isBot && mySeat === dummy) {
              // Human partner plays Declarer or Dummy when partnered with Bot Declarer
              canIPlayThisHand = true;
            }
          }

          return (
            <div key={seatKey} className={`seat-box seat-${seatKey}`}>
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

              {/* Declarer / Turn Banner Guidance */}
              {canIPlayThisHand && isDummy && declarer === mySeat && (
                <div style={{ fontSize: '0.75rem', color: '#e5c158', fontWeight: '800', marginBottom: '4px' }}>
                  ★ Declarer's Turn to Play from Dummy
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

            {isDisplayingPreviousTrick && (
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
                Previous Trick won by {SEAT_NAMES[lastCompletedTrick.winner]}
              </div>
            )}

            {displayCards.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.25)', fontSize: '0.85rem' }}>
                {isBiddingPhase ? 'Bidding Phase in progress...' : 'Lead card to start trick'}
              </div>
            )}
          </div>

          {waitingForContinue && (
            <div style={{ position: 'absolute', bottom: '15px', zIndex: 25 }}>
              <button
                className="copy-btn"
                style={{
                  padding: '10px 24px',
                  fontSize: '0.95rem',
                  boxShadow: '0 0 20px rgba(229, 193, 88, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={onContinueTrick}
              >
                <Play size={16} fill="#0b131e" /> Continue to Next Trick
              </button>
            </div>
          )}
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
