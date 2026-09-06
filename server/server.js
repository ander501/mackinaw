// server/server.js
// Express & Socket.IO server with persistence & re-connection support

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import {
  SEATS,
  SEAT_NAMES,
  PARTNERSHIPS,
  OPPONENTS,
  dealHands,
  nextSeat,
  isValidBid,
  evaluateAuction,
  getLegalPlays,
  determineTrickWinner,
  calculateScore
} from './gameEngine.js';

import { generateBotBid, generateBotBidDetailed, generateBotPlay } from './ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'rooms_data.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// In-memory rooms database: roomId -> roomState
const rooms = new Map();

function saveRoomsToDisk() {
  try {
    const data = {};
    for (const [id, room] of rooms.entries()) {
      data[id] = room;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving rooms to disk:', err);
  }
}

function loadRoomsFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      if (content.trim()) {
        const data = JSON.parse(content);
        for (const id in data) {
          const room = data[id];
          if (room.gameState === 'ROUND_OVER' && !room.contract) {
            startNextHand(room);
          }
          rooms.set(id, room);
        }
        console.log(`Loaded ${rooms.size} room(s) from disk.`);
      }
    }
  } catch (err) {
    console.error('Error loading rooms from disk:', err);
  }
}

function createInitialRoomState(roomId) {
  const hands = dealHands();
  return {
    roomId,
    createdAt: Date.now(),
    seats: {
      N: null,
      E: null,
      S: null,
      W: null
    },
    spectators: [],
    dealer: 'N',
    currentTurn: 'N',
    gameState: 'BIDDING',
    hands,
    biddingHistory: [],
    contract: null,
    currentTrick: [],
    lastCompletedTrick: null,
    ledSuit: null,
    tricksWon: { NS: 0, EW: 0 },
    trickHistory: [],
    rubberScore: {
      gameIndex: 1,
      belowLine: { NS: 0, EW: 0 },
      gamesWon: { NS: 0, EW: 0 },
      vulnerable: { NS: false, EW: false },
      roundsHistory: []
    },
    chat: [],
    systemMessage: 'Welcome to Rubber Bridge! Invite friends by sharing the room URL.'
  };
}

loadRoomsFromDisk();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createInitialRoomState(roomId));
    saveRoomsToDisk();
  }
  return rooms.get(roomId);
}

function sanitizeRoomStateForClient(room, socketId) {
  let mySeat = null;
  for (const seat of SEATS) {
    if (room.seats[seat] && room.seats[seat].socketId === socketId) {
      mySeat = seat;
      break;
    }
  }

  const isSpectator = !mySeat;
  const sanitizedHands = {};
  const isPlayingPhase = room.gameState === 'PLAYING';
  const declarer = room.contract ? room.contract.declarer : null;
  const dummy = room.contract ? room.contract.dummy : null;

  for (const seat of SEATS) {
    if (isSpectator) {
      if (isPlayingPhase && seat === dummy) {
        sanitizedHands[seat] = room.hands[seat];
      } else {
        sanitizedHands[seat] = room.hands[seat] ? room.hands[seat].length : 0;
      }
    } else if (seat === mySeat) {
      sanitizedHands[seat] = room.hands[seat];
    } else if (isPlayingPhase && seat === dummy) {
      sanitizedHands[seat] = room.hands[seat];
    } else if (isPlayingPhase && seat === declarer) {
      if (PARTNERSHIPS[mySeat] === PARTNERSHIPS[declarer]) {
        sanitizedHands[seat] = room.hands[seat];
      } else {
        sanitizedHands[seat] = room.hands[seat] ? room.hands[seat].length : 0;
      }
    } else {
      sanitizedHands[seat] = room.hands[seat] ? room.hands[seat].length : 0;
    }
  }

  return {
    ...room,
    mySeat,
    isSpectator,
    hands: sanitizedHands
  };
}

function broadcastRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  saveRoomsToDisk();

  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;

  for (const socketId of roomSockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('room_state', sanitizeRoomStateForClient(room, socketId));
    }
  }
}

function handleBotTurns(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const currentSeat = room.currentTurn;
  const seatInfo = room.seats[currentSeat];

  if (!seatInfo || !seatInfo.isBot) {
    return;
  }

  setTimeout(async () => {
    const freshRoom = rooms.get(roomId);
    if (!freshRoom) return;

    if (freshRoom.gameState === 'BIDDING' && freshRoom.currentTurn === currentSeat) {
      const hand = freshRoom.hands[currentSeat];
      const botTeam = PARTNERSHIPS[currentSeat];
      const oppTeam = OPPONENTS[botTeam];
      const vulWe = freshRoom.rubberScore ? Boolean(freshRoom.rubberScore.vulnerable[botTeam]) : false;
      const vulThey = freshRoom.rubberScore ? Boolean(freshRoom.rubberScore.vulnerable[oppTeam]) : false;

      const bidResult = await generateBotBidDetailed(
        hand,
        freshRoom.biddingHistory,
        currentSeat,
        freshRoom.dealer,
        { we: vulWe, they: vulThey }
      );

      processBid(freshRoom, currentSeat, bidResult.bid, bidResult.convention);
      broadcastRoomState(roomId);
      handleBotTurns(roomId);
    } else if (freshRoom.gameState === 'PLAYING' && freshRoom.currentTurn === currentSeat) {
      const declarer = freshRoom.contract.declarer;
      const dummy = freshRoom.contract.dummy;

      if (currentSeat === declarer || currentSeat === dummy) {
        const declarerInfo = freshRoom.seats[declarer];
        const dummyInfo = freshRoom.seats[dummy];
        const hasHumanInPartnership = (declarerInfo && !declarerInfo.isBot) || (dummyInfo && !dummyInfo.isBot);
        if (hasHumanInPartnership) {
          return;
        }
      }

      const handToPlay = freshRoom.hands[currentSeat];
      const dummyHand = freshRoom.hands[dummy];

      const botPlayCard = generateBotPlay(
        handToPlay,
        freshRoom.currentTrick,
        freshRoom.ledSuit,
        freshRoom.contract.suit,
        dummyHand,
        currentSeat === declarer
      );

      if (botPlayCard) {
        processPlayCard(freshRoom, currentSeat, botPlayCard.id);
        broadcastRoomState(roomId);
        handleBotTurns(roomId);
      }
    }
  }, 900);
}

function processBid(room, seat, bid, convention = null) {
  if (!isValidBid(bid, room.biddingHistory, seat)) return false;

  room.biddingHistory.push({ seat, bid });
  const alertText = convention ? ` (${convention})` : '';
  room.chat.push({
    sender: 'System',
    text: `${SEAT_NAMES[seat]} bid ${bid}${alertText}`,
    timestamp: Date.now()
  });

  const auctionResult = evaluateAuction(room.biddingHistory, room.dealer);

  if (auctionResult) {
    if (auctionResult.status === 'PASSED_OUT') {
      startNextHand(room);
      room.systemMessage = 'Previous hand passed out! New hand dealt.';
    } else if (auctionResult.status === 'CONTRACT_SET') {
      room.contract = auctionResult.contract;
      room.gameState = 'PLAYING';
      room.currentTurn = room.contract.openingLeader;
      room.systemMessage = `Contract set: ${room.contract.bid} by ${SEAT_NAMES[room.contract.declarer]}. Opening lead: ${SEAT_NAMES[room.contract.openingLeader]}`;
    }
  } else {
    room.currentTurn = nextSeat(seat);
  }

  return true;
}

function processPlayCard(room, playerSeat, cardId) {
  const currentSeat = room.currentTurn;
  const hand = room.hands[currentSeat];
  if (!hand) return false;
  const cardIndex = hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return false;

  const card = hand[cardIndex];

  const legalPlays = getLegalPlays(hand, room.currentTrick, room.ledSuit);
  if (!legalPlays.some(c => c.id === cardId)) return false;

  hand.splice(cardIndex, 1);
  if (room.currentTrick.length === 0) {
    room.ledSuit = card.suit;
  }
  room.currentTrick.push({ seat: currentSeat, card });

  if (room.currentTrick.length < 4) {
    let next = nextSeat(currentSeat);
    room.currentTurn = next;
  } else {
    const winnerSeat = determineTrickWinner(room.currentTrick, room.contract.suit);
    const winningTeam = PARTNERSHIPS[winnerSeat];
    room.tricksWon[winningTeam]++;

    room.lastCompletedTrick = {
      trick: [...room.currentTrick],
      winner: winnerSeat,
      ledSuit: room.ledSuit
    };

    room.trickHistory.push(room.lastCompletedTrick);

    room.systemMessage = `${SEAT_NAMES[winnerSeat]} won the trick!`;

    room.currentTrick = [];
    room.ledSuit = null;
    room.currentTurn = winnerSeat;

    const totalTricksPlayed = room.tricksWon.NS + room.tricksWon.EW;
    if (totalTricksPlayed === 13) {
      finishHand(room);
    }
  }

  return true;
}

function finishHand(room) {
  room.gameState = 'ROUND_OVER';
  const declarerTeam = room.contract.team;
  const defenderTeam = OPPONENTS[declarerTeam];
  const tricksWonDeclarer = room.tricksWon[declarerTeam];
  const isVulnerable = room.rubberScore.vulnerable[declarerTeam];

  const score = calculateScore(room.contract, tricksWonDeclarer, isVulnerable);
  const roundSummary = {
    contract: room.contract,
    tricksWon: room.tricksWon,
    score
  };

  room.rubberScore.roundsHistory.push(roundSummary);

  if (score.isMade) {
    room.rubberScore.belowLine[declarerTeam] += score.belowLine;

    if (room.rubberScore.belowLine[declarerTeam] >= 100) {
      room.rubberScore.gamesWon[declarerTeam]++;
      room.rubberScore.vulnerable[declarerTeam] = true;
      room.rubberScore.vulnerable[defenderTeam] = true;

      room.rubberScore.belowLine = { NS: 0, EW: 0 };
      room.rubberScore.gameIndex++;

      room.systemMessage = `${declarerTeam} team won Game ${room.rubberScore.gameIndex - 1}!`;

      if (room.rubberScore.gamesWon[declarerTeam] === 2) {
        room.gameState = 'RUBBER_OVER';
        const isSweep = room.rubberScore.gamesWon[defenderTeam] === 0;
        const rubberBonus = isSweep ? 700 : 500;

        room.systemMessage = `RUBBER COMPLETED! ${declarerTeam} team won the Rubber with a ${rubberBonus} point bonus!`;
        return;
      }
    }
  }

  room.systemMessage = `Hand Finished! ${score.isMade ? 'Contract Made' : 'Contract Defeated'}. Score updated on Rubber Scorecard.`;
}

function startNextHand(room) {
  room.dealer = nextSeat(room.dealer);
  room.currentTurn = room.dealer;
  room.gameState = 'BIDDING';
  room.hands = dealHands();
  room.biddingHistory = [];
  room.contract = null;
  room.currentTrick = [];
  room.lastCompletedTrick = null;
  room.ledSuit = null;
  room.tricksWon = { NS: 0, EW: 0 };
  room.trickHistory = [];
  room.systemMessage = `New hand dealt! Dealer is ${SEAT_NAMES[room.dealer]}. Bidding phase started.`;
}

io.on('connection', (socket) => {
  let currentRoomId = null;
  let userName = 'Guest';
  let userPlayerId = null;

  socket.on('join_room', ({ roomId, name, playerId }) => {
    currentRoomId = roomId || 'default';
    userName = name || `Player_${socket.id.slice(0, 4)}`;
    userPlayerId = playerId || socket.id;

    socket.join(currentRoomId);
    const room = getRoom(currentRoomId);

    if (room.gameState === 'ROUND_OVER' && !room.contract) {
      startNextHand(room);
    }

    let assignedSeat = null;
    for (const seat of SEATS) {
      if (room.seats[seat] && (room.seats[seat].playerId === userPlayerId || room.seats[seat].name === userName)) {
        room.seats[seat].socketId = socket.id;
        room.seats[seat].name = userName;
        assignedSeat = seat;
        break;
      }
    }

    if (!assignedSeat) {
      for (const seat of SEATS) {
        if (!room.seats[seat]) {
          room.seats[seat] = { socketId: socket.id, playerId: userPlayerId, name: userName, isBot: false };
          assignedSeat = seat;
          break;
        }
      }
    }

    if (!assignedSeat) {
      const existingSpec = room.spectators.find(sp => sp.playerId === userPlayerId);
      if (existingSpec) {
        existingSpec.socketId = socket.id;
      } else {
        room.spectators.push({ socketId: socket.id, playerId: userPlayerId, name: userName });
      }
    }

    broadcastRoomState(currentRoomId);
    handleBotTurns(currentRoomId);
  });

  socket.on('claim_seat', ({ seat }) => {
    if (!currentRoomId || !SEATS.includes(seat)) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    for (const s of SEATS) {
      if (room.seats[s] && (room.seats[s].socketId === socket.id || room.seats[s].playerId === userPlayerId)) {
        room.seats[s] = null;
      }
    }
    room.spectators = room.spectators.filter(sp => sp.socketId !== socket.id && sp.playerId !== userPlayerId);

    if (!room.seats[seat] || room.seats[seat].isBot) {
      room.seats[seat] = { socketId: socket.id, playerId: userPlayerId, name: userName, isBot: false };
    } else {
      room.spectators.push({ socketId: socket.id, playerId: userPlayerId, name: userName });
    }

    broadcastRoomState(currentRoomId);
    handleBotTurns(currentRoomId);
  });

  socket.on('add_bot', ({ seat }) => {
    if (!currentRoomId || !SEATS.includes(seat)) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (!room.seats[seat]) {
      room.seats[seat] = { socketId: `bot_${seat}`, playerId: `bot_${seat}`, name: `Bot ${SEAT_NAMES[seat]}`, isBot: true };
      broadcastRoomState(currentRoomId);
      handleBotTurns(currentRoomId);
    }
  });

  socket.on('remove_bot', ({ seat }) => {
    if (!currentRoomId || !SEATS.includes(seat)) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (room.seats[seat] && room.seats[seat].isBot) {
      room.seats[seat] = null;
      broadcastRoomState(currentRoomId);
    }
  });

  socket.on('place_bid', ({ bid }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState !== 'BIDDING') return;

    const currentSeat = room.currentTurn;
    const playerSeatInfo = room.seats[currentSeat];
    if (!playerSeatInfo || playerSeatInfo.socketId !== socket.id) return;

    if (processBid(room, currentSeat, bid)) {
      broadcastRoomState(currentRoomId);
      handleBotTurns(currentRoomId);
    }
  });

  socket.on('play_card', ({ cardId }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState !== 'PLAYING') return;

    const currentSeat = room.currentTurn;
    const declarer = room.contract ? room.contract.declarer : null;
    const dummy = room.contract ? room.contract.dummy : null;

    let allowedSocketIds = [];
    if (room.seats[currentSeat] && !room.seats[currentSeat].isBot) {
      allowedSocketIds.push(room.seats[currentSeat].socketId);
    }

    if (currentSeat === dummy && declarer && room.seats[declarer] && !room.seats[declarer].isBot) {
      allowedSocketIds.push(room.seats[declarer].socketId);
    }

    if (declarer && dummy) {
      const declarerInfo = room.seats[declarer];
      const dummyInfo = room.seats[dummy];
      if (currentSeat === declarer || currentSeat === dummy) {
        if (declarerInfo && !declarerInfo.isBot) allowedSocketIds.push(declarerInfo.socketId);
        if (dummyInfo && !dummyInfo.isBot) allowedSocketIds.push(dummyInfo.socketId);
      }
    }

    if (!allowedSocketIds.includes(socket.id)) return;

    if (processPlayCard(room, currentSeat, cardId)) {
      broadcastRoomState(currentRoomId);
      handleBotTurns(currentRoomId);
    }
  });

  socket.on('start_next_hand', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState !== 'ROUND_OVER') return;
    startNextHand(room);
    broadcastRoomState(currentRoomId);
    handleBotTurns(currentRoomId);
  });

  socket.on('restart_rubber', () => {
    if (!currentRoomId) return;
    rooms.set(currentRoomId, createInitialRoomState(currentRoomId));
    broadcastRoomState(currentRoomId);
  });

  socket.on('send_chat', ({ message }) => {
    if (!currentRoomId || !message) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.chat.push({
      sender: userName,
      text: message,
      timestamp: Date.now()
    });
    broadcastRoomState(currentRoomId);
  });

  socket.on('disconnect', () => {
    // Retain player seat on disconnect so refresh preserves seat & state
  });
});

app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
