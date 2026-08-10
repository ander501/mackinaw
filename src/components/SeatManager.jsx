// src/components/SeatManager.jsx
import React from 'react';
import { UserPlus, Bot, Eye } from 'lucide-react';

const SEAT_LABELS = { N: 'North', E: 'East', S: 'South', W: 'West' };

export default function SeatManager({ seats, spectators, mySeat, isSpectator, onClaimSeat, onAddBot, onRemoveBot }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '12px' }}>
        <Eye size={14} color="#3b82f6" />
        <span>{spectators.length} Spectators</span>
      </div>

      {isSpectator && (
        <div style={{ fontSize: '0.8rem', color: '#e5c158', fontWeight: '600' }}>
          (You are Spectating)
        </div>
      )}
    </div>
  );
}
