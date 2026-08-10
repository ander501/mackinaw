// server/gameEngine.js
// Complete Contract Bridge Game Engine for Rubber Bridge

export const SUITS = ['C', 'D', 'H', 'S']; // Order of suits
export const SUIT_SYMBOLS = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };
export const SEATS = ['N', 'E', 'S', 'W'];
export const SEAT_NAMES = { N: 'North', E: 'East', S: 'South', W: 'West' };
export const PARTNERSHIPS = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' };
export const OPPONENTS = { NS: 'EW', EW: 'NS' };

export function createDeck() {
  const deck = [];
  const suits = ['C', 'D', 'H', 'S'];
  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) {
      let name = rank.toString();
      if (rank === 11) name = 'J';
      if (rank === 12) name = 'Q';
      if (rank === 13) name = 'K';
      if (rank === 14) name = 'A';
      deck.push({
        id: `${suit}${rank}`,
        suit,
        rank,
        name,
        symbol: SUIT_SYMBOLS[suit]
      });
    }
  }
  return deck;
}

export function shuffle(deck) {
  const array = [...deck];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function sortCards(cards) {
  const suitOrder = { S: 4, H: 3, D: 2, C: 1 };
  return [...cards].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[b.suit] - suitOrder[a.suit];
    }
    return b.rank - a.rank;
  });
}

export function calculateHCP(cards) {
  let hcp = 0;
  for (const card of cards) {
    if (card.rank === 14) hcp += 4;
    else if (card.rank === 13) hcp += 3;
    else if (card.rank === 12) hcp += 2;
    else if (card.rank === 11) hcp += 1;
  }
  return hcp;
}

export function dealHands() {
  const deck = shuffle(createDeck());
  return {
    N: sortCards(deck.slice(0, 13)),
    E: sortCards(deck.slice(13, 26)),
    S: sortCards(deck.slice(26, 39)),
    W: sortCards(deck.slice(39, 52))
  };
}

export function nextSeat(seat) {
  const index = SEATS.indexOf(seat);
  return SEATS[(index + 1) % 4];
}

export function getBidValue(bid) {
  if (['P', 'X', 'XX'].includes(bid)) return 0;
  const level = parseInt(bid[0], 10);
  const suit = bid.slice(1);
  const suitVal = { C: 1, D: 2, H: 3, S: 4, NT: 5 }[suit];
  return (level - 1) * 5 + suitVal;
}

export function isValidBid(bid, biddingHistory, playerSeat) {
  const nonPassBids = biddingHistory.filter(b => b.bid !== 'P');
  const lastNonPass = nonPassBids.length > 0 ? nonPassBids[nonPassBids.length - 1] : null;

  if (bid === 'P') return true;

  if (bid === 'X') {
    if (!lastNonPass) return false;
    if (lastNonPass.bid === 'X' || lastNonPass.bid === 'XX') return false;
    return PARTNERSHIPS[lastNonPass.seat] !== PARTNERSHIPS[playerSeat];
  }

  if (bid === 'XX') {
    if (!lastNonPass) return false;
    if (lastNonPass.bid !== 'X') return false;
    return PARTNERSHIPS[lastNonPass.seat] !== PARTNERSHIPS[playerSeat];
  }

  const newValue = getBidValue(bid);
  if (!lastNonPass) return true;

  const lastValue = getBidValue(lastNonPass.bid);
  return newValue > lastValue;
}

export function evaluateAuction(biddingHistory, dealer) {
  if (biddingHistory.length < 4) return null;

  if (biddingHistory.length === 4 && biddingHistory.every(b => b.bid === 'P')) {
    return { status: 'PASSED_OUT' };
  }

  const lastThree = biddingHistory.slice(-3);
  if (lastThree.length === 3 && lastThree.every(b => b.bid === 'P')) {
    const nonPassBids = biddingHistory.filter(b => b.bid !== 'P');
    const winningBidObj = nonPassBids[nonPassBids.length - 1];

    let multiplier = 1;
    let finalBid = winningBidObj.bid;
    let winningSeat = winningBidObj.seat;

    for (let i = biddingHistory.length - 1; i >= 0; i--) {
      if (biddingHistory[i].bid === 'XX') {
        multiplier = 4;
        break;
      }
      if (biddingHistory[i].bid === 'X') {
        multiplier = 2;
        break;
      }
      if (!['P', 'X', 'XX'].includes(biddingHistory[i].bid)) {
        finalBid = biddingHistory[i].bid;
        winningSeat = biddingHistory[i].seat;
        break;
      }
    }

    const level = parseInt(finalBid[0], 10);
    const suit = finalBid.slice(1);
    const winningTeam = PARTNERSHIPS[winningSeat];

    let declarer = winningSeat;
    for (const b of biddingHistory) {
      if (PARTNERSHIPS[b.seat] === winningTeam && b.bid.endsWith(suit)) {
        declarer = b.seat;
        break;
      }
    }

    const dummy = { N: 'S', S: 'N', E: 'W', W: 'E' }[declarer];
    const openingLeader = nextSeat(declarer);

    return {
      status: 'CONTRACT_SET',
      contract: {
        bid: finalBid,
        level,
        suit,
        multiplier,
        declarer,
        dummy,
        openingLeader,
        targetTricks: 6 + level,
        team: winningTeam
      }
    };
  }

  return null;
}

export function getLegalPlays(hand, currentTrick, ledSuit) {
  if (hand.length === 0) return [];
  if (!ledSuit || currentTrick.length === 0) return hand;

  const sameSuitCards = hand.filter(c => c.suit === ledSuit);
  if (sameSuitCards.length > 0) {
    return sameSuitCards;
  }
  return hand;
}

export function determineTrickWinner(trick, trumpSuit) {
  const ledSuit = trick[0].card.suit;
  let winningPlay = trick[0];

  for (let i = 1; i < trick.length; i++) {
    const play = trick[i];
    const currentWinCard = winningPlay.card;
    const playCard = play.card;

    if (trumpSuit !== 'NT' && playCard.suit === trumpSuit) {
      if (currentWinCard.suit !== trumpSuit) {
        winningPlay = play;
      } else if (playCard.rank > currentWinCard.rank) {
        winningPlay = play;
      }
    } else if (playCard.suit === ledSuit && currentWinCard.suit === ledSuit) {
      if (playCard.rank > currentWinCard.rank) {
        winningPlay = play;
      }
    }
  }

  return winningPlay.seat;
}

export function calculateScore(contract, tricksWonDeclarer, isVulnerable) {
  const { level, suit, multiplier, team } = contract;
  const target = 6 + level;
  const tricksMade = tricksWonDeclarer;
  const isMade = tricksMade >= target;
  const overtricks = tricksMade - target;
  const undertricks = target - tricksMade;

  let trickPoints = 0;
  let overtrickPoints = 0;
  let undertrickPenalties = 0;
  let slamBonus = 0;
  let insultBonus = 0;

  if (isMade) {
    if (suit === 'C' || suit === 'D') {
      trickPoints = level * 20;
    } else if (suit === 'H' || suit === 'S') {
      trickPoints = level * 30;
    } else if (suit === 'NT') {
      trickPoints = 40 + (level - 1) * 30;
    }

    if (multiplier === 2) trickPoints *= 2;
    if (multiplier === 4) trickPoints *= 4;

    if (overtricks > 0) {
      if (multiplier === 1) {
        const val = (suit === 'C' || suit === 'D') ? 20 : 30;
        overtrickPoints = overtricks * val;
      } else if (multiplier === 2) {
        overtrickPoints = overtricks * (isVulnerable ? 200 : 100);
      } else if (multiplier === 4) {
        overtrickPoints = overtricks * (isVulnerable ? 400 : 200);
      }
    }

    if (multiplier === 2) insultBonus = 50;
    if (multiplier === 4) insultBonus = 100;

    if (level === 6) slamBonus = isVulnerable ? 750 : 500;
    if (level === 7) slamBonus = isVulnerable ? 1500 : 1000;

    const totalBelowLine = trickPoints;
    const totalAboveLine = overtrickPoints + insultBonus + slamBonus;

    return {
      team,
      isMade: true,
      belowLine: totalBelowLine,
      aboveLine: totalAboveLine,
      pointsDeclarer: totalBelowLine + totalAboveLine,
      pointsDefenders: 0,
      overtricks,
      undertricks: 0
    };
  } else {
    const defTeam = OPPONENTS[team];
    if (multiplier === 1) {
      undertrickPenalties = undertricks * (isVulnerable ? 100 : 50);
    } else if (multiplier === 2) {
      if (!isVulnerable) {
        for (let i = 1; i <= undertricks; i++) {
          if (i === 1) undertrickPenalties += 100;
          else if (i === 2 || i === 3) undertrickPenalties += 200;
          else undertrickPenalties += 300;
        }
      } else {
        for (let i = 1; i <= undertricks; i++) {
          if (i === 1) undertrickPenalties += 200;
          else undertrickPenalties += 300;
        }
      }
    } else if (multiplier === 4) {
      let doubledPen = 0;
      if (!isVulnerable) {
        for (let i = 1; i <= undertricks; i++) {
          if (i === 1) doubledPen += 100;
          else if (i === 2 || i === 3) doubledPen += 200;
          else doubledPen += 300;
        }
      } else {
        for (let i = 1; i <= undertricks; i++) {
          if (i === 1) doubledPen += 200;
          else doubledPen += 300;
        }
      }
      undertrickPenalties = doubledPen * 2;
    }

    return {
      team: defTeam,
      isMade: false,
      belowLine: 0,
      aboveLine: undertrickPenalties,
      pointsDeclarer: 0,
      pointsDefenders: undertrickPenalties,
      overtricks: 0,
      undertricks
    };
  }
}
