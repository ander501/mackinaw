// src/components/BiddingTable.jsx
import React from 'react';

const SEATS_ORDER = ['W', 'N', 'E', 'S'];
const SEAT_LABELS = { W: 'West', N: 'North', E: 'East', S: 'South' };
const SUIT_SYMBOLS = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };

export default function BiddingTable({ biddingHistory, dealer }) {
  if (!dealer) dealer = 'N';

  // Build grid matrix: rows of 4 columns [West, North, East, South]
  const rows = [];
  let currentRow = ['', '', '', ''];

  // Calculate starting column index based on dealer
  const dealerColIdx = SEATS_ORDER.indexOf(dealer);

  // Fill pre-dealer cells with '-'
  for (let i = 0; i < dealerColIdx; i++) {
    currentRow[i] = '-';
  }

  let colIdx = dealerColIdx;

  biddingHistory.forEach((bObj) => {
    currentRow[colIdx] = bObj.bid;
    colIdx++;
    if (colIdx === 4) {
      rows.push(currentRow);
      currentRow = ['', '', '', ''];
      colIdx = 0;
    }
  });

  if (currentRow.some((c) => c !== '')) {
    rows.push(currentRow);
  }

  return (
    <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', width: '100%' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#e5c158', marginBottom: '6px', textAlign: 'center', letterSpacing: '0.5px' }}>
        BIDDING SUMMARY TABLE
      </div>

      <table className="score-table" style={{ fontSize: '0.8rem' }}>
        <thead>
          <tr>
            <th>WEST</th>
            <th>NORTH</th>
            <th>EAST</th>
            <th>SOUTH</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="4" style={{ color: '#64748b', fontSize: '0.75rem' }}>No bids yet</td>
            </tr>
          ) : (
            rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => {
                  let formatted = cell;
                  let color = '#cbd5e1';

                  if (cell === 'P') {
                    formatted = 'Pass';
                    color = '#10b981';
                  } else if (cell === 'X') {
                    formatted = 'Double';
                    color = '#ef4444';
                  } else if (cell === 'XX') {
                    formatted = 'Redouble';
                    color = '#a855f7';
                  } else if (cell && cell !== '-') {
                    const level = cell[0];
                    const suit = cell.slice(1);
                    const isRed = suit === 'H' || suit === 'D';
                    color = isRed ? '#ef4444' : suit === 'NT' ? '#e5c158' : '#f8fafc';
                    formatted = `${level}${SUIT_SYMBOLS[suit] || suit}`;
                  }

                  return (
                    <td key={cIdx} style={{ color, fontWeight: cell && cell !== '-' ? '700' : '400' }}>
                      {formatted}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
