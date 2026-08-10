// src/components/RulesModal.jsx
import React from 'react';
import { X, BookOpen, CheckCircle } from 'lucide-react';

export default function RulesModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', fontWeight: '800', color: '#e5c158' }}>
            <BookOpen size={20} /> CONTRACT BRIDGE RULES & SAYC CHEAT SHEET
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ maxHeight: '420px', overflowY: 'auto', fontSize: '0.85rem', lineHeight: '1.5', color: '#cbd5e1' }}>
          <h4 style={{ color: '#e5c158', marginBottom: '6px' }}>1. High Card Points (HCP)</h4>
          <p style={{ marginBottom: '12px' }}>
            Ace = 4 pts | King = 3 pts | Queen = 2 pts | Jack = 1 pt. Total 40 pts in deck.
          </p>

          <h4 style={{ color: '#e5c158', marginBottom: '6px' }}>2. SAYC Opening Bids</h4>
          <ul style={{ paddingLeft: '18px', marginBottom: '12px' }}>
            <li><strong>1NT</strong>: 15–17 HCP with balanced distribution (no void/singleton, max one doubleton).</li>
            <li><strong>1♥ / 1♠</strong>: 12–21 HCP with 5+ card major.</li>
            <li><strong>1♣ / 1♦</strong>: 12–21 HCP with 3+ cards in minor (longest minor).</li>
            <li><strong>2♣</strong>: 22+ HCP artificial strong opening.</li>
            <li><strong>2NT</strong>: 20–21 HCP balanced.</li>
            <li><strong>3♣/3♦/3♥/3♠</strong>: 6–10 HCP preemptive with 7-card suit.</li>
          </ul>

          <h4 style={{ color: '#e5c158', marginBottom: '6px' }}>3. Trick Play Rules</h4>
          <p style={{ marginBottom: '12px' }}>
            Players must follow suit led if possible. If unable to follow suit, any card or trump card can be played. The highest card of led suit wins, unless a trump is played (highest trump wins). Winner of each trick leads the next!
          </p>

          <h4 style={{ color: '#e5c158', marginBottom: '6px' }}>4. Rubber Bridge Scoring</h4>
          <p>
            First team to win 2 Games (100+ trick points below the line per game) wins the Rubber! A 2-0 sweep awards a 700 pt rubber bonus; a 2-1 win awards 500 pt bonus.
          </p>
        </div>

        <button onClick={onClose} className="copy-btn" style={{ width: '100%', marginTop: '16px', padding: '10px' }}>
          Got It! Return to Game
        </button>
      </div>
    </div>
  );
}
