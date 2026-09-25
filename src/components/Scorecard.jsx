// src/components/Scorecard.jsx
import React from 'react';
import { Award, ShieldAlert } from 'lucide-react';

export default function Scorecard({ rubberScore }) {
  const { belowLine, gamesWon, vulnerable, roundsHistory } = rubberScore;

  // Calculate totals above line
  let nsAboveTotal = 0;
  let ewAboveTotal = 0;

  roundsHistory.forEach(r => {
    if (r.score.team === 'NS') {
      nsAboveTotal += r.score.aboveLine;
    } else {
      ewAboveTotal += r.score.aboveLine;
    }
  });

  return (
    <div className="scorecard-box">
      <div className="scorecard-header">
        <div className="scorecard-title">RUBBER SCORECARD</div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Game {rubberScore.gameIndex} of 3</div>
      </div>

      {/* Vulnerability Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '10px', fontSize: '0.78rem' }}>
        <div style={{ color: vulnerable.NS ? '#ef4444' : '#10b981', fontWeight: '700' }}>
          NS: {vulnerable.NS ? 'VULNERABLE' : 'Not Vul'} ({gamesWon.NS} Games)
        </div>
        <div style={{ color: vulnerable.EW ? '#ef4444' : '#10b981', fontWeight: '700' }}>
          EW: {vulnerable.EW ? 'VULNERABLE' : 'Not Vul'} ({gamesWon.EW} Games)
        </div>
      </div>

      <table className="score-table">
        <thead>
          <tr>
            <th>NORTH - SOUTH</th>
            <th>EAST - WEST</th>
          </tr>
        </thead>
        <tbody>
          {/* Above the Line (Honors, Overtricks, Slams, Penalties) */}
          <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <td>{nsAboveTotal > 0 ? `+${nsAboveTotal}` : '-'}</td>
            <td>{ewAboveTotal > 0 ? `+${ewAboveTotal}` : '-'}</td>
          </tr>

          {/* The Line Divider */}
          <tr>
            <td colSpan="2" className="score-divider" style={{ textAlign: 'center', fontSize: '0.7rem', color: '#e5c158', padding: '2px' }}>
              ━━━━ ABOVE / BELOW LINE ━━━━
            </td>
          </tr>

          {/* Below the Line (Trick Points towards current game) */}
          <tr style={{ fontWeight: '800', fontSize: '1.05rem', color: '#e5c158' }}>
            <td>{belowLine.NS} / 100</td>
            <td>{belowLine.EW} / 100</td>
          </tr>
        </tbody>
      </table>

      {/* Round History Mini Log */}
      <div style={{ marginTop: '12px', maxHeight: '120px', overflowY: 'auto', fontSize: '0.75rem' }}>
        <div style={{ fontWeight: '700', color: '#94a3b8', marginBottom: '4px' }}>ROUNDS COMPLETED</div>
        {roundsHistory.length === 0 ? (
          <div style={{ color: '#64748b' }}>No hands finished yet in this rubber.</div>
        ) : (
          roundsHistory.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span>Round {i + 1}: {r.contract.bid}{r.contract.multiplier === 2 ? ' (X)' : r.contract.multiplier === 4 ? ' (XX)' : ''} ({r.contract.declarer})</span>
              <span style={{ color: r.score.isMade ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                {r.score.isMade
                  ? `Made${r.score.overtricks > 0 ? ` +${r.score.overtricks}` : ''} (+${r.score.belowLine + r.score.aboveLine})`
                  : `Down -${r.score.undertricks ?? 0} (-${r.score.aboveLine})`}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
