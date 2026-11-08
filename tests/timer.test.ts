import { describe, it, expect } from 'vitest';
import { BlockClock } from '../src/engine/timer';

function setup(duration: number) {
  let t = 1000;
  const clock = new BlockClock(duration, () => t);
  return { clock, advance: (ms: number) => { t += ms; } };
}

describe('BlockClock', () => {
  it('computes from timestamps, not tick counts', () => {
    const { clock, advance } = setup(60);
    clock.start();
    advance(12_345);
    expect(clock.elapsedSec()).toBeCloseTo(12.345, 3);
    expect(clock.remainingSec()).toBeCloseTo(47.655, 3);
  });

  it('survives a long gap between reads (throttled tab)', () => {
    const { clock, advance } = setup(60);
    clock.start();
    advance(45_000);
    expect(clock.elapsedSec()).toBe(45);
  });

  it('pause freezes time and resume continues', () => {
    const { clock, advance } = setup(60);
    clock.start(); advance(10_000);
    clock.pause(); advance(30_000);
    expect(clock.elapsedSec()).toBe(10);
    clock.resume(); advance(5_000);
    expect(clock.elapsedSec()).toBe(15);
  });

  it('add seconds extends the block', () => {
    const { clock, advance } = setup(30);
    clock.start(); advance(25_000);
    clock.addSeconds(10);
    expect(clock.durationSec).toBe(40);
    expect(clock.remainingSec()).toBe(15);
  });

  it('is done at the duration and does not go negative', () => {
    const { clock, advance } = setup(5);
    clock.start(); advance(9_000);
    expect(clock.isDone()).toBe(true);
    expect(clock.remainingSec()).toBe(0);
    expect(clock.elapsedSec()).toBe(5);
  });

  it('pause before start and double pause are harmless', () => {
    const { clock, advance } = setup(10);
    clock.pause(); advance(1000); clock.start(); advance(2000); clock.pause(); clock.pause(); advance(5000);
    expect(clock.elapsedSec()).toBe(2);
  });
});
