// src/App.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Table from './components/Table';
import Scorecard from './components/Scorecard';
import BiddingTable from './components/BiddingTable';
import BiddingBox from './components/BiddingBox';
import Chat from './components/Chat';
import RulesModal from './components/RulesModal';
import SeatManager from './components/SeatManager';
import { Share2, BookOpen, RotateCcw, Eye, ShieldCheck, Trophy, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

const socket = io(window.location.origin, {
  autoConnect: false
});

function getRoomIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  let room = urlParams.get('room');
  if (!room) {
    room = 'rubber-' + Math.random().toString(36).substring(2, 8);
    window.history.replaceState({}, '', `?room=${room}`);
  }
  return room;
}

function getOrCreatePlayerId() {
  let pid = localStorage.getItem('bridge_player_id');
  if (!pid) {
    pid = 'pid_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('bridge_player_id', pid);
  }
  return pid;
}

export default function App() {
  const [roomId] = useState(getRoomIdFromURL);
  const [playerId] = useState(getOrCreatePlayerId);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('bridge_name') || '');
  const [hasEnteredName, setHasEnteredName] = useState(() => !!localStorage.getItem('bridge_name'));
  const [roomState, setRoomState] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hasEnteredName) return;

    socket.connect();
    socket.emit('join_room', { roomId, name: playerName, playerId });

    socket.on('room_state', (state) => {
      setRoomState(state);

      if (state.gameState === 'RUBBER_OVER') {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      }
    });

    return () => {
      socket.off('room_state');
      socket.disconnect();
    };
  }, [roomId, hasEnteredName, playerName, playerId]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      localStorage.setItem('bridge_name', playerName.trim());
      setHasEnteredName(true);
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlaceBid = (bid) => {
    socket.emit('place_bid', { bid });
  };

  const handlePlayCard = (cardId) => {
    socket.emit('play_card', { cardId });
  };

  const handleContinueTrick = () => {
    socket.emit('continue_trick');
  };

  const handleClaimSeat = (seat) => {
    socket.emit('claim_seat', { seat });
  };

  const handleAddBot = (seat) => {
    socket.emit('add_bot', { seat });
  };

  const handleRemoveBot = (seat) => {
    socket.emit('remove_bot', { seat });
  };

  const handleSendMessage = (message) => {
    socket.emit('send_chat', { message });
  };

  const handleNextHand = () => {
    socket.emit('start_next_hand');
  };

  const handleRestartRubber = () => {
    if (window.confirm('Restart current Rubber and reset scores?')) {
      socket.emit('restart_rubber');
    }
  };

  if (!hasEnteredName) {
    return (
      <div className="modal-backdrop">
        <div className="modal-content" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: '#e5c158' }}>
            <Sparkles size={36} />
          </div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', color: '#e5c158', marginBottom: '8px' }}>
            Welcome to Bridge Table
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '20px' }}>
            Enter your display name to join room <strong>{roomId}</strong>
          </p>

          <form onSubmit={handleNameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              className="chat-input"
              style={{ fontSize: '1rem', padding: '12px', textAlign: 'center' }}
              placeholder="Your Name (e.g. Grandma, Alice)"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className="copy-btn" style={{ padding: '12px', fontSize: '1rem' }}>
              Join Rubber Table
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', color: '#e5c158' }}>
        <h2>Connecting to Bridge Room...</h2>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="app-header">
        <div className="brand-title">
          <span>♠♥ Bridge Table</span>
          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(229, 193, 88, 0.15)', color: '#e5c158', border: '1px solid #e5c158' }}>
            Rubber Bridge
          </span>
        </div>

        <div className="room-bar">
          <Share2 size={15} color="#e5c158" />
          <span className="room-url-text">Room: {roomId}</span>
          <button className="copy-btn" onClick={copyRoomLink}>
            {copied ? 'Link Copied!' : 'Share Room URL'}
          </button>
        </div>

        <div className="header-controls">
          <SeatManager
            seats={roomState.seats}
            spectators={roomState.spectators}
            mySeat={roomState.mySeat}
            isSpectator={roomState.isSpectator}
            onClaimSeat={handleClaimSeat}
            onAddBot={handleAddBot}
            onRemoveBot={handleRemoveBot}
          />

          <button className="nav-btn" onClick={() => setShowRules(true)}>
            <BookOpen size={16} /> Rules & SAYC
          </button>

          <button className="nav-btn" onClick={handleRestartRubber} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
            <RotateCcw size={16} /> Reset Rubber
          </button>
        </div>
      </header>

      {/* Spectator Alert Banner */}
      {roomState.isSpectator && (
        <div className="spectator-banner">
          <Eye size={16} /> You are in <strong>Spectator Mode</strong> (4 active players seated). You can watch the live bidding, tricks, and scorecard!
        </div>
      )}

      {/* System Status Message */}
      <div style={{ background: 'rgba(0,0,0,0.4)', textAlign: 'center', padding: '6px 12px', fontSize: '0.85rem', color: '#e5c158', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {roomState.systemMessage}
      </div>

      {/* Main Workspace Layout */}
      <div className="main-workspace">
        <Table
          roomState={roomState}
          socket={socket}
          onPlaceBid={handlePlaceBid}
          onPlayCard={handlePlayCard}
          onAddBot={handleAddBot}
          onRemoveBot={handleRemoveBot}
          onClaimSeat={handleClaimSeat}
          onContinueTrick={handleContinueTrick}
        />

        <div className="sidebar-panel" style={{ overflowY: 'auto' }}>
          <Scorecard rubberScore={roomState.rubberScore} />

          {/* Live Bidding Table in Sidebar */}
          <div style={{ padding: '12px', borderBottom: '1px solid var(--glass-border)' }}>
            <BiddingTable biddingHistory={roomState.biddingHistory} dealer={roomState.dealer} />
          </div>

          {/* Bidding Controls (Possible Bids) in Sidebar during Bidding Phase */}
          {roomState.gameState === 'BIDDING' && (
            <div style={{ padding: '12px', borderBottom: '1px solid var(--glass-border)' }}>
              <BiddingBox
                isMyTurn={roomState.currentTurn === roomState.mySeat}
                biddingHistory={roomState.biddingHistory}
                onPlaceBid={handlePlaceBid}
                mySeat={roomState.mySeat}
                currentTurn={roomState.currentTurn}
                seats={roomState.seats}
              />
            </div>
          )}

          {roomState.gameState === 'ROUND_OVER' && (
            <div style={{ padding: '12px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', borderBottom: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <button className="copy-btn" style={{ padding: '10px 20px', width: '100%', fontSize: '0.9rem' }} onClick={handleNextHand}>
                Deal Next Hand →
              </button>
            </div>
          )}

          {roomState.gameState === 'RUBBER_OVER' && (
            <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(229, 193, 88, 0.2)', borderBottom: '1px solid var(--gold-accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', color: '#e5c158', fontWeight: '800', marginBottom: '8px' }}>
                <Trophy size={20} /> RUBBER COMPLETED!
              </div>
              <button className="copy-btn" style={{ width: '100%', padding: '10px' }} onClick={handleRestartRubber}>
                Start New Rubber
              </button>
            </div>
          )}

          <Chat
            chatMessages={roomState.chat}
            onSendMessage={handleSendMessage}
            isBiddingPhase={roomState.gameState === 'BIDDING'}
          />
        </div>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
