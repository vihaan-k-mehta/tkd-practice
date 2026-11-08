import { exerciseById } from './exercises';
import type { Block, Routine, Target } from './types';

/** A block with the exercise defaults, optionally overriding the target. */
export function blockFor(exerciseId: string, over: Target = {}): Block {
  const ex = exerciseById(exerciseId);
  if (!ex) throw new Error(`Unknown exercise ${exerciseId}`);
  return { exerciseId, target: { ...ex.defaultTarget, ...over }, sides: ex.perSide ? 'both' : undefined };
}
const b = blockFor;

const warmup = () => [b('leg-swing-front'), b('leg-swing-side'), b('hip-circles'), b('knee-raises')];
const cooldown = () => [b('hamstring', { seconds: 30 }), b('butterfly', { seconds: 30 })];

export const TEMPLATES: Routine[] = [
  {
    id: 'bill-wallace', name: 'Bill Wallace routine', template: true,
    blocks: [...warmup(), { ...b('bill-wallace-routine'), sides: 'both' }, ...cooldown()],
  },
  {
    id: 'daily-stretch', name: 'Daily stretch', template: true,
    blocks: [b('leg-swing-front'), b('leg-swing-side'), b('hip-circles'), b('hamstring'), b('hip-flexor'), b('quad'), b('calf'), b('butterfly'), b('straddle'), b('pigeon')],
  },
  {
    id: 'kick-bw', name: 'Kick day with Bill Wallace', template: true,
    blocks: [
      ...warmup(), b('chamber', { rounds: 1 }),
      b('bill-wallace'),                       // 3 sets of 10 per leg at the current weight
      b('bill-wallace', { rounds: 1 }),        // final speed set with no weight
      ...cooldown(),
    ],
  },
  {
    id: 'bag-day', name: 'Bag day', template: true,
    blocks: [...warmup(), b('bag-roundhouse'), b('bag-combos'), b('bag-power', { rounds: 3 }), ...cooldown()],
  },
  {
    id: 'plyo-legs', name: 'Plyo and legs', template: true,
    blocks: [b('knee-raises'), b('jump-squat'), b('skater-jump'), b('tuck-jump'), b('lunge-jump'), b('jump-rope'), b('calf-hop'), b('static-stretch')],
  },
  {
    id: 'shadow-day', name: 'Shadow sparring', template: true,
    blocks: [...warmup(), b('shadow'), b('spar-footwork', { rounds: 2 }), b('spar-continuous', { rounds: 2 }), ...cooldown()],
  },
  {
    id: 'full-session', name: 'Full session', template: true,
    blocks: [
      ...warmup(), b('roundhouse'), b('side-kick'), b('bill-wallace'), b('bag-roundhouse', { rounds: 3 }),
      b('shadow', { rounds: 2 }), b('static-stretch'), b('breathing', { seconds: 60 }),
    ],
  },
];
