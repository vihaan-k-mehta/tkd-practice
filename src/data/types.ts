export type Equipment = 'ankleWeights' | 'bands' | 'heavyBag' | 'rope' | 'box';
export type BlockType = 'hold' | 'reps' | 'rounds' | 'rest';
export type Verify = 'none' | 'presence' | 'motion' | 'reps';
export type Sides = 'both' | 'left' | 'right';

export interface Target { seconds?: number; reps?: number; rounds?: number; workSec?: number; restSec?: number }

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
}

export interface Block { exerciseId: string; target: Target; sides?: Sides }
export interface Routine { id: string; name: string; blocks: Block[]; template?: boolean; /** Set on a shortened copy: the routine it came from. */ baseId?: string }

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  ankleWeights: 'Ankle weights', bands: 'Resistance bands', heavyBag: 'Heavy bag', rope: 'Jump rope', box: 'Box',
};
