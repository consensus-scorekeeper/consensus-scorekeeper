// Session lifecycle on the setup screen: a refresh always lands on setup,
// Resume Game re-enters a saved game, Start Game warns before discarding
// one, and Clear saved game appears only when a save exists. Driven through
// main.js's real data-action dispatcher against the injected index.html.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state, saveState, loadState, startGame } from '../src/main.js';
import { hasGameInProgress } from '../src/state.js';
import { resetState, makeQ } from './helpers.js';

const setupEl = () => document.getElementById('setup');
const gameEl = () => document.getElementById('game');
const resumeBtn = () => document.getElementById('resume-btn');
const clearBtn = () => document.getElementById('clear-save-btn');
const click = (action) => document.querySelector(`[data-action="${action}"]`).click();

function seedInProgressGame() {
  state.teamA = { name: 'Alphas', players: [{ name: 'A1', points: 20 }], score: 20 };
  state.teamB = { name: 'Bravos', players: [{ name: 'B1', points: 0 }], score: 0 };
  state.questions = [makeQ(1), makeQ(2)];
  state.hasQuestions = true;
  state.currentQuestion = 1;
  state.history = [{ team: 'a', playerIndex: 0, points: 20, question: 0 }];
  state.answeredQuestions = new Set([0]);
}

beforeEach(() => {
  resetState();
  localStorage.clear();
  setupEl().style.display = 'block';
  gameEl().style.display = 'none';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hasGameInProgress', () => {
  it('is false for a fresh state and true once anything scored', () => {
    expect(hasGameInProgress()).toBe(false);
    state.history.push({ team: 'a', playerIndex: 0, points: 10, question: 0 });
    expect(hasGameInProgress()).toBe(true);
  });
});

describe('loadState lands on setup', () => {
  it('restores an in-progress game without entering the game screen', () => {
    seedInProgressGame();
    saveState();
    resetState();

    expect(loadState()).toBe(true);
    expect(gameEl().style.display).toBe('none');
    expect(setupEl().style.display).toBe('block');
    expect(state.teamA.score).toBe(20);
  });

  it('shows Resume + Clear only when a saved game with progress exists', () => {
    seedInProgressGame();
    saveState();
    resetState();
    loadState();
    expect(resumeBtn().style.display).not.toBe('none');
    expect(clearBtn().style.display).not.toBe('none');
  });

  it('hides Resume + Clear when nothing is saved', () => {
    loadState();
    expect(resumeBtn().style.display).toBe('none');
    expect(clearBtn().style.display).toBe('none');
  });

  it('hides Resume but keeps Clear for a saved setup with no progress yet', () => {
    state.teamA.players = [{ name: 'A1', points: 0 }];
    saveState();
    resetState();
    loadState();
    expect(resumeBtn().style.display).toBe('none');
    expect(clearBtn().style.display).not.toBe('none');
  });
});

describe('Resume Game', () => {
  it('re-enters the game screen with restored scores intact', () => {
    seedInProgressGame();
    saveState();
    resetState();
    loadState();

    click('resume-game');
    expect(gameEl().style.display).toBe('block');
    expect(setupEl().style.display).toBe('none');
    expect(state.teamA.score).toBe(20);
    expect(state.currentQuestion).toBe(1);
  });

  it('back-to-setup returns to setup and keeps Resume available', () => {
    seedInProgressGame();
    saveState();
    resetState();
    loadState();
    click('resume-game');

    click('back-to-setup');
    expect(setupEl().style.display).toBe('block');
    expect(gameEl().style.display).toBe('none');
    expect(resumeBtn().style.display).not.toBe('none');
  });
});

describe('Start Game guard', () => {
  it('asks before discarding a game in progress and aborts on cancel', () => {
    seedInProgressGame();
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);

    click('start-game');
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(gameEl().style.display).toBe('none');
    expect(state.teamA.score).toBe(20);
    expect(state.history).toHaveLength(1);
  });

  it('starts fresh (scores reset) when confirmed', () => {
    seedInProgressGame();
    vi.stubGlobal('confirm', vi.fn(() => true));

    click('start-game');
    expect(gameEl().style.display).toBe('block');
    expect(state.teamA.score).toBe(0);
    expect(state.history).toEqual([]);
    expect(state.answeredQuestions.size).toBe(0);
  });

  it('does not prompt when there is no progress to lose', () => {
    state.teamA.players = [{ name: 'A1', points: 0 }];
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);

    click('start-game');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(gameEl().style.display).toBe('block');
  });

  it('the tutorial-style direct startGame() call never prompts', () => {
    seedInProgressGame();
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);
    startGame();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(gameEl().style.display).toBe('block');
  });
});
