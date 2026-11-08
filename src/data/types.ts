export type Equipment = 'ankleWeights' | 'bands' | 'heavyBag' | 'rope' | 'box';
export type BlockType = 'hold' | 'reps' | 'rounds' | 'rest' | 'sequence';
export type Verify = 'none' | 'presence' | 'motion' | 'reps';
export type Sides = 'both' | 'left' | 'right';

export interface Target { seconds?: number; reps?: number; rounds?: number; workSec?: number; restSec?: number; /** Ankle weight in pounds. */ weight?: number }

/** One kick pattern in a sequence, and how many kicks one repetition of it contains. */
export type KickPattern = 'round' | 'low-high' | 'hook-round' | 'low-high-mid-hook-round';
export const PATTERN_KICKS: Record<KickPattern, number> = { round: 1, 'low-high': 2, 'hook-round': 2, 'low-high-mid-hook-round': 5 };
export const PATTERN_LABEL: Record<KickPattern, string> = { round: 'Roundhouse', 'low-high': 'Low-high', 'hook-round': 'Hook then round', 'low-high-mid-hook-round': 'Low, high, middle, hook, round' };
/** A continuous routine for one leg. The foot only touches down in the `down` phases. */
export type SeqPhase =
  | { kind: 'hold'; seconds: number; label: string }
  | { kind: 'kicks'; reps: number; tempo: 'slow' | 'fast'; pattern: KickPattern; label: string }
  | { kind: 'down'; seconds: number; label: string };

export interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: Equipment[];
  blockType: BlockType;
  defaultTarget: Target;
  perSide?: boolean; // default for Block.sides
  cues: string[];
  demoClip?: string;
  verify: Verify;
  needsPartner?: boolean;
  sequence?: SeqPhase[];
}

export interface Block { exerciseId: string; target: Target; sides?: Sides }
export interface Routine { id: string; name: string; blocks: Block[]; template?: boolean; /** Set on a shortened copy: the routine it came from. */ baseId?: string }

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  ankleWeights: 'Ankle weights', bands: 'Resistance bands', heavyBag: 'Heavy bag', rope: 'Jump rope', box: 'Box',
};
