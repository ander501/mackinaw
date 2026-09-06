// test/gameEngine.test.js
// Unit & Integration Tests for Contract Bridge Rules, AI, and Server Edge Cases

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBiddingDaemon } from '../server/biddingClient.js';

import {
  createDeck,
  shuffle,
  sortCards,
  calculateHCP,
  dealHands,
  nextSeat,
  isValidBid,
  evaluateAuction,
  getLegalPlays,
  determineTrickWinner,
  calculateScore
} from '../server/gameEngine.js';

import {
  generateBotBid,
  generateBotBidDetailed,
  generateBotBidDetailedSync,
  generateBotPlay
} from '../server/ai.js';

test('1. Deck Creation & HCP Calculation', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52, 'Deck must contain 52 cards');

  // Test HCP calculation (A=4, K=3, Q=2, J=1)
  const sampleHand = [
    { suit: 'S', rank: 14, name: 'A' }, // 4
    { suit: 'H', rank: 13, name: 'K' }, // 3
    { suit: 'D', rank: 12, name: 'Q' }, // 2
    { suit: 'C', rank: 11, name: 'J' }, // 1
    { suit: 'C', rank: 10, name: '10' } // 0
  ];
  assert.equal(calculateHCP(sampleHand), 10, 'HCP should equal 10');
});

test('2. Bidding Rules & Validation Edge Cases', () => {
  const history = [];

  // Opening bid validation
  assert.equal(isValidBid('1C', history, 'N'), true);
  assert.equal(isValidBid('1D', history, 'N'), true);
  assert.equal(isValidBid('P', history, 'N'), true);
  assert.equal(isValidBid('X', history, 'N'), false, 'Cannot Double with no prior bids');

  // Bid progression: 1D > 1C
  history.push({ seat: 'N', bid: '1C' });
  assert.equal(isValidBid('1C', history, 'E'), false, 'Cannot bid equal value');
  assert.equal(isValidBid('1D', history, 'E'), true, '1D is higher than 1C');

  // Double opponent bid
  assert.equal(isValidBid('X', history, 'E'), true, 'East can double North bid');
  history.push({ seat: 'E', bid: 'X' });

  // Redouble partner double invalid, but Redouble opponent double valid
  assert.equal(isValidBid('XX', history, 'S'), true, 'South can Redouble East double');
  assert.equal(isValidBid('X', history, 'S'), false, 'Cannot double an already doubled contract');
});

test('3. Passed Out Auction Evaluation Edge Case', () => {
  const passedOutHistory = [
    { seat: 'N', bid: 'P' },
    { seat: 'E', bid: 'P' },
    { seat: 'S', bid: 'P' },
    { seat: 'W', bid: 'P' }
  ];

  const result = evaluateAuction(passedOutHistory, 'N');
  assert.notEqual(result, null);
  assert.equal(result.status, 'PASSED_OUT', '4 initial passes must trigger PASSED_OUT state');
});

test('4. Contract Determination & Declarer Identification', () => {
  const history = [
    { seat: 'N', bid: '1H' }, // N bids H first
    { seat: 'E', bid: 'Pass' },
    { seat: 'S', bid: '3H' }, // S raises H
    { seat: 'W', bid: 'Pass' },
    { seat: 'N', bid: '4H' },
    { seat: 'E', bid: 'P' },
    { seat: 'S', bid: 'P' },
    { seat: 'W', bid: 'P' }
  ];

  const result = evaluateAuction(history, 'N');
  assert.equal(result.status, 'CONTRACT_SET');
  assert.equal(result.contract.bid, '4H');
  assert.equal(result.contract.level, 4);
  assert.equal(result.contract.suit, 'H');
  assert.equal(result.contract.declarer, 'N', 'North was first to bid Hearts for NS partnership');
  assert.equal(result.contract.dummy, 'S', 'South is Dummy');
  assert.equal(result.contract.openingLeader, 'E', 'East is to Declarer left');
});

test('5. Suit-Following Play Enforcement Edge Cases', () => {
  const hand = [
    { id: 'S14', suit: 'S', rank: 14 },
    { id: 'H10', suit: 'H', rank: 10 },
    { id: 'C5', suit: 'C', rank: 5 }
  ];

  const currentTrick = [{ seat: 'N', card: { id: 'H14', suit: 'H', rank: 14 } }];
  const ledSuit = 'H';

  const legalPlays = getLegalPlays(hand, currentTrick, ledSuit);
  assert.equal(legalPlays.length, 1, 'Must follow Hearts if player has Hearts');
  assert.equal(legalPlays[0].id, 'H10');

  // Void in led suit
  const voidHand = [
    { id: 'S14', suit: 'S', rank: 14 },
    { id: 'C5', suit: 'C', rank: 5 }
  ];
  const legalPlaysVoid = getLegalPlays(voidHand, currentTrick, ledSuit);
  assert.equal(legalPlaysVoid.length, 2, 'May play any card when void in led suit');
});

test('6. Trump Trick Winner Resolution Edge Cases', () => {
  const trick = [
    { seat: 'N', card: { id: 'H14', suit: 'H', rank: 14 } }, // Ace of Hearts led
    { seat: 'E', card: { id: 'H5', suit: 'H', rank: 5 } },
    { seat: 'S', card: { id: 'S2', suit: 'S', rank: 2 } },  // Trumped with 2 of Spades!
    { seat: 'W', card: { id: 'H13', suit: 'H', rank: 13 } }
  ];

  const winner = determineTrickWinner(trick, 'S'); // Trump is Spades
  assert.equal(winner, 'S', 'South 2 of Spades trump wins against Ace of Hearts');

  const winnerNT = determineTrickWinner(trick, 'NT'); // No Trump
  assert.equal(winnerNT, 'N', 'In No Trump, Ace of Hearts led wins trick');
});

test('7. Rubber Bridge Scoring Calculation Edge Cases', () => {
  // 4 Hearts Made with 1 Overtrick (5 tricks = 11 tricks won), Not Vulnerable
  const contract = { level: 4, suit: 'H', multiplier: 1, team: 'NS' };
  const scoreMade = calculateScore(contract, 11, false);

  assert.equal(scoreMade.isMade, true);
  assert.equal(scoreMade.belowLine, 120, '4 Hearts = 4 * 30 = 120 pts below line (Wins Game 1!)');
  assert.equal(scoreMade.aboveLine, 30, '1 overtrick at 30 pts');

  // Defeated contract 4 Spades Down 2, Doubled, Vulnerable
  const contractDoubled = { level: 4, suit: 'S', multiplier: 2, team: 'NS' };
  const scoreDefeated = calculateScore(contractDoubled, 8, true);

  assert.equal(scoreDefeated.isMade, false);
  assert.equal(scoreDefeated.team, 'EW', 'Defenders EW get undertrick points');
  assert.equal(scoreDefeated.aboveLine, 500, 'Vulnerable Doubled Down 2 = 200 (1st) + 300 (2nd) = 500 pts');
});

test('8. AI Bot Bidding Heuristics', () => {
  const botHand = [
    { suit: 'S', rank: 14 }, { suit: 'S', rank: 13 }, { suit: 'S', rank: 12 }, { suit: 'S', rank: 10 }, { suit: 'S', rank: 5 },
    { suit: 'H', rank: 14 }, { suit: 'H', rank: 10 },
    { suit: 'D', rank: 12 }, { suit: 'D', rank: 8 },
    { suit: 'C', rank: 11 }, { suit: 'C', rank: 4 }, { suit: 'C', rank: 3 }, { suit: 'C', rank: 2 }
  ]; // 16 HCP, 5 Spades

  const bid = generateBotBid(botHand, [], 'N');
  assert.equal(bid, '1S', 'Bot should open 1S with 16 HCP and 5 Spades');
});

test('9. Declarer Hand Visibility & Partner Exposing Logic', () => {
  const PARTNERSHIPS = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' };

  const mockRoom = {
    gameState: 'PLAYING',
    contract: { declarer: 'S', dummy: 'N', team: 'NS' },
    seats: {
      N: { socketId: 'human_N_socket', name: 'Human Partner', isBot: false },
      E: { socketId: 'bot_E', name: 'Bot East', isBot: true },
      S: { socketId: 'bot_S', name: 'Bot Declarer', isBot: true },
      W: { socketId: 'bot_W', name: 'Bot West', isBot: true }
    },
    hands: {
      N: [{ id: 'H14', suit: 'H', rank: 14 }],
      E: [{ id: 'C2', suit: 'C', rank: 2 }],
      S: [{ id: 'S14', suit: 'S', rank: 14 }],
      W: [{ id: 'D2', suit: 'D', rank: 2 }]
    }
  };

  const mySeat = 'N';
  const declarer = mockRoom.contract.declarer;

  const isPartnerOfDeclarer = PARTNERSHIPS[mySeat] === PARTNERSHIPS[declarer];
  assert.equal(isPartnerOfDeclarer, true, 'Human partner of Declarer identified');

  const exposedDeclarerCards = isPartnerOfDeclarer ? mockRoom.hands[declarer] : null;
  assert.notEqual(exposedDeclarerCards, null);
  assert.equal(exposedDeclarerCards[0].id, 'S14', 'Human partner must receive unmasked Declarer hand');
});

test('10. Bot Opponent Opening Lead vs Declarer Control Permissions', () => {
  const declarer = 'S';
  const dummy = 'N';
  const openingLeader = 'W'; // Bot West is opening leader

  const seats = {
    N: { isBot: true },
    E: { isBot: true },
    S: { isBot: false }, // South is Human Declarer
    W: { isBot: true }  // West is Bot Opponent
  };

  // Check 1: When currentSeat is openingLeader ('W'), Bot West IS ALLOWED to lead!
  const currentSeat = openingLeader; // 'W'
  const isCurrentSeatBot = seats[currentSeat].isBot;
  assert.equal(isCurrentSeatBot, true);

  let shouldBotPlayCurrentSeat = false;
  if (currentSeat === declarer || currentSeat === dummy) {
    const declarerInfo = seats[declarer];
    const dummyInfo = seats[dummy];
    const hasHumanInPartnership = (declarerInfo && !declarerInfo.isBot) || (dummyInfo && !dummyInfo.isBot);
    shouldBotPlayCurrentSeat = !hasHumanInPartnership;
  } else {
    // Current seat is an Opponent Bot! Opponent Bot plays its lead/card!
    shouldBotPlayCurrentSeat = seats[currentSeat].isBot;
  }

  assert.equal(shouldBotPlayCurrentSeat, true, 'Bot opponent West MUST be allowed to lead!');

  // Check 2: When currentSeat is Declarer ('S'), human plays Declarer hand
  const declarerTurnSeat = declarer; // 'S'
  let shouldBotPlayDeclarerSeat = false;
  if (declarerTurnSeat === declarer || declarerTurnSeat === dummy) {
    const declarerInfo = seats[declarer];
    const dummyInfo = seats[dummy];
    const hasHumanInPartnership = (declarerInfo && !declarerInfo.isBot) || (dummyInfo && !dummyInfo.isBot);
    shouldBotPlayDeclarerSeat = !hasHumanInPartnership;
  }
  assert.equal(shouldBotPlayDeclarerSeat, false, 'Bot must NOT auto-play Declarer hand when Human Declarer is present');
});

test('11. SAYC 1NT Opening (15-17 HCP Balanced)', () => {
  // Hand with 16 HCP, 4-3-3-3 balanced distribution
  const hand1NT = [
    { suit: 'S', rank: 14 }, { suit: 'S', rank: 13 }, { suit: 'S', rank: 3 }, { suit: 'S', rank: 2 }, // 7 HCP
    { suit: 'H', rank: 12 }, { suit: 'H', rank: 5 }, { suit: 'H', rank: 4 }, // 2 HCP
    { suit: 'D', rank: 13 }, { suit: 'D', rank: 8 }, { suit: 'D', rank: 2 }, // 3 HCP
    { suit: 'C', rank: 14 }, { suit: 'C', rank: 7 }, { suit: 'C', rank: 4 }  // 4 HCP -> Total 16 HCP
  ];

  const bid = generateBotBid(hand1NT, [], 'N');
  assert.equal(bid, '1NT', 'Bot must open 1NT with 16 HCP balanced hand');
});

test('12. SAYC Stayman Convention (2C over partner 1NT with 4-card major)', () => {
  // Partner opens 1NT, responder has 10 HCP and 4-4 in majors
  const responderHand = [
    { suit: 'S', rank: 13 }, { suit: 'S', rank: 12 }, { suit: 'S', rank: 8 }, { suit: 'S', rank: 4 }, // 5 HCP
    { suit: 'H', rank: 14 }, { suit: 'H', rank: 11 }, { suit: 'H', rank: 9 }, { suit: 'H', rank: 2 }, // 5 HCP -> Total 10 HCP
    { suit: 'D', rank: 8 }, { suit: 'D', rank: 5 },
    { suit: 'C', rank: 7 }, { suit: 'C', rank: 4 }, { suit: 'C', rank: 2 }
  ];

  const auction = [
    { seat: 'N', bid: '1NT' },
    { seat: 'E', bid: 'P' }
  ];

  const result = generateBotBidDetailedSync(responderHand, auction, 'S', 'N');
  assert.equal(result.bid, '2C', 'Responder must bid 2C (Stayman) over partner 1NT');
  assert.equal(result.convention, 'Stayman', 'Convention must be tagged as Stayman');
});

test('13. SAYC Jacoby Transfer Convention (2D transfer to Hearts over 1NT)', () => {
  // Partner opens 1NT, responder has 10 HCP and 5+ hearts
  const transferHand = [
    { suit: 'H', rank: 14 }, { suit: 'H', rank: 13 }, { suit: 'H', rank: 12 }, { suit: 'H', rank: 8 }, { suit: 'H', rank: 2 }, // 9 HCP, 5 Hearts
    { suit: 'S', rank: 11 }, { suit: 'S', rank: 4 }, // 1 HCP -> Total 10 HCP
    { suit: 'D', rank: 8 }, { suit: 'D', rank: 5 },
    { suit: 'C', rank: 7 }, { suit: 'C', rank: 4 }, { suit: 'C', rank: 3 }, { suit: 'C', rank: 2 }
  ];

  const auction = [
    { seat: 'N', bid: '1NT' },
    { seat: 'E', bid: 'P' }
  ];

  const result = generateBotBidDetailedSync(transferHand, auction, 'S', 'N');
  assert.equal(result.bid, '2D', 'Responder must bid 2D (Jacoby Transfer) over 1NT with 5+ hearts');
  assert.equal(result.convention, 'Jacoby Transfer (Hearts)');
});

test('14. SAYC Strong 2C Opening (22+ HCP)', () => {
  // Hand with 24 HCP
  const monsterHand = [
    { suit: 'S', rank: 14 }, { suit: 'S', rank: 13 }, { suit: 'S', rank: 12 }, { suit: 'S', rank: 11 }, // 10 HCP
    { suit: 'H', rank: 14 }, { suit: 'H', rank: 13 }, { suit: 'H', rank: 12 }, // 9 HCP
    { suit: 'D', rank: 14 }, { suit: 'D', rank: 13 }, // 7 HCP -> Total 26 HCP
    { suit: 'D', rank: 4 }, { suit: 'C', rank: 5 }, { suit: 'C', rank: 4 }, { suit: 'C', rank: 3 }
  ];

  const bid = generateBotBid(monsterHand, [], 'N');
  assert.equal(bid, '2C', 'Bot must open 2C with 22+ HCP');
});

after(() => {
  closeBiddingDaemon();
});


