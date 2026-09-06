// server/biddingClient.js
// Node.js client for the SAYC bridge bidding system Python engine

import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_PATH = path.join(__dirname, 'bidding_system', 'service.py');

let pythonProcess = null;
let requestId = 0;
const pendingRequests = new Map();
let incomingBuffer = '';

function startPythonDaemon() {
  try {
    pythonProcess = spawn('python3', [SCRIPT_PATH, '--daemon'], {
      cwd: path.join(__dirname, 'bidding_system'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    pythonProcess.unref();
    if (pythonProcess.stdin && pythonProcess.stdin.unref) pythonProcess.stdin.unref();
    if (pythonProcess.stdout && pythonProcess.stdout.unref) pythonProcess.stdout.unref();
    if (pythonProcess.stderr && pythonProcess.stderr.unref) pythonProcess.stderr.unref();

    pythonProcess.stdout.on('data', (data) => {
      incomingBuffer += data.toString('utf-8');
      const lines = incomingBuffer.split('\n');
      incomingBuffer = lines.pop(); // Keep incomplete trailing fragment

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const response = JSON.parse(trimmed);
          const reqId = response.id;
          if (pendingRequests.has(reqId)) {
            const { resolve, timer } = pendingRequests.get(reqId);
            clearTimeout(timer);
            pendingRequests.delete(reqId);
            resolve(response);
          }
        } catch (err) {
          console.error('[biddingClient] Error parsing Python response:', err, trimmed);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.warn('[biddingClient daemon stderr]:', data.toString('utf-8'));
    });

    pythonProcess.on('exit', (code, signal) => {
      console.warn(`[biddingClient] Python daemon exited (code: ${code}, signal: ${signal}).`);
      pythonProcess = null;
      // Reject any pending requests
      for (const [id, { reject, timer }] of pendingRequests.entries()) {
        clearTimeout(timer);
        reject(new Error('Python daemon exited unexpectedly'));
      }
      pendingRequests.clear();
    });

    pythonProcess.on('error', (err) => {
      console.error('[biddingClient] Failed to spawn Python daemon:', err);
      pythonProcess = null;
    });
  } catch (err) {
    console.error('[biddingClient] Error initializing Python daemon:', err);
    pythonProcess = null;
  }
}

// Start daemon initially
startPythonDaemon();

function getSaycBidSync(hand, biddingHistory, botSeat, dealer, vulnerability) {
  try {
    const payload = JSON.stringify({
      id: 0,
      hand,
      biddingHistory,
      botSeat,
      dealer: dealer || 'N',
      vulnerability: vulnerability || { we: false, they: false }
    });

    const result = spawnSync('python3', [SCRIPT_PATH, payload], {
      cwd: path.join(__dirname, 'bidding_system'),
      encoding: 'utf-8',
      timeout: 1000
    });

    if (result.status === 0 && result.stdout) {
      const parsed = JSON.parse(result.stdout.trim());
      if (parsed.success && parsed.bid) {
        return {
          bid: parsed.bid,
          convention: parsed.convention || null
        };
      }
    }
  } catch (err) {
    console.warn('[biddingClient] Sync fallback failed:', err.message);
  }
  return null;
}

export async function getSaycBotBid(hand, biddingHistory, botSeat, dealer, vulnerability, timeoutMs = 1200) {
  if (!pythonProcess || pythonProcess.killed) {
    startPythonDaemon();
  }

  if (!pythonProcess) {
    return getSaycBidSync(hand, biddingHistory, botSeat, dealer, vulnerability);
  }

  const id = ++requestId;
  const payload = {
    id,
    hand,
    biddingHistory,
    botSeat,
    dealer: dealer || 'N',
    vulnerability: vulnerability || { we: false, they: false }
  };

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      // Try synchronous one-shot fallback before giving up
      const fallback = getSaycBidSync(hand, biddingHistory, botSeat, dealer, vulnerability);
      resolve(fallback);
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve: (response) => {
        if (response && response.success && response.bid) {
          resolve({
            bid: response.bid,
            convention: response.convention || null
          });
        } else {
          resolve(null);
        }
      },
      reject: () => {
        const fallback = getSaycBidSync(hand, biddingHistory, botSeat, dealer, vulnerability);
        resolve(fallback);
      },
      timer
    });

    try {
      pythonProcess.stdin.write(JSON.stringify(payload) + '\n');
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      const fallback = getSaycBidSync(hand, biddingHistory, botSeat, dealer, vulnerability);
      resolve(fallback);
    }
  });
}

// Synchronous version for places where synchronous call is required
export function getSaycBotBidSync(hand, biddingHistory, botSeat, dealer, vulnerability) {
  return getSaycBidSync(hand, biddingHistory, botSeat, dealer, vulnerability);
}

export function closeBiddingDaemon() {
  if (pythonProcess) {
    try {
      pythonProcess.kill();
    } catch (_) {}
    pythonProcess = null;
  }
}
