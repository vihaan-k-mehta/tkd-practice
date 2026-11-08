import type { Equipment, Exercise, Target, Verify } from './types';

export const CATEGORIES = [
  'Dynamic warm-up', 'Stretching', 'Kick technique', 'Ankle weights', 'Resistance bands',
  'Heavy bag', 'Shadow sparring', 'Sparring formats', 'Plyometrics', 'Cool-down',
] as const;

type Init = Pick<Exercise, 'id' | 'name' | 'cues'> & Partial<Exercise>;
const mk = (category: string, blockType: Exercise['blockType'], defaultTarget: Target, verify: Verify, equipment: Equipment[] = []) =>
  (e: Init): Exercise => ({ category, blockType, defaultTarget, verify, equipment, ...e });

const warm = mk('Dynamic warm-up', 'reps', { reps: 12 }, 'none');
const stretch = mk('Stretching', 'hold', { seconds: 40 }, 'presence');
const tech = mk('Kick technique', 'reps', { reps: 10, rounds: 3, restSec: 60 }, 'reps');
const weights = mk('Ankle weights', 'reps', { reps: 8, rounds: 3, restSec: 60 }, 'reps', ['ankleWeights']);
const bands = mk('Resistance bands', 'reps', { reps: 12, rounds: 3, restSec: 45 }, 'none', ['bands']);
const bag = mk('Heavy bag', 'rounds', { rounds: 3, workSec: 180, restSec: 60 }, 'motion', ['heavyBag']);
const shadow = mk('Shadow sparring', 'rounds', { rounds: 4, workSec: 120, restSec: 30 }, 'motion');
const spar = mk('Sparring formats', 'rounds', { rounds: 3, workSec: 120, restSec: 60 }, 'motion');
const plyo = mk('Plyometrics', 'rounds', { rounds: 4, workSec: 30, restSec: 30 }, 'motion');
const cool = mk('Cool-down', 'hold', { seconds: 60 }, 'presence');

export const EXERCISES: Exercise[] = [
  warm({ id: 'leg-swing-front', name: 'Front leg swings', perSide: true, cues: ['Stand tall, hold a wall if needed', 'Swing from the hip, not the back', 'Keep the swing smooth and relaxed'] }),
  warm({ id: 'leg-swing-side', name: 'Side leg swings', perSide: true, cues: ['Face the wall and swing across your body', 'Keep your hips square', 'Go a little higher each swing'] }),
  warm({ id: 'hip-circles', name: 'Hip circles', perSide: true, cues: ['Lift the knee, then draw a big circle', 'Stay upright', 'Reverse direction halfway'] }),
  warm({ id: 'knee-raises', name: 'Knee raises', perSide: true, cues: ['Drive the knee to hip height', 'Stay tall on the standing leg', 'Lower under control'] }),
  warm({ id: 'ankle-circles', name: 'Ankle circles', perSide: true, defaultTarget: { reps: 10 }, cues: ['Slow, full circles', 'Switch direction halfway'] }),

  stretch({ id: 'hamstring', name: 'Hamstring stretch', perSide: true, cues: ['Hinge from the hips, back flat', 'Stop at a stretch, not pain', 'Breathe out as you lean in'] }),
  stretch({ id: 'hip-flexor', name: 'Hip flexor lunge', perSide: true, cues: ['Back knee down, hips forward', 'Squeeze the back glute', 'Keep your chest up'] }),
  stretch({ id: 'butterfly', name: 'Butterfly', defaultTarget: { seconds: 45 }, cues: ['Soles together, sit tall', 'Let the knees fall, do not push them', 'Fold forward from the hips'] }),
  stretch({ id: 'straddle', name: 'Straddle', defaultTarget: { seconds: 45 }, cues: ['Legs wide, toes up', 'Walk your hands forward, back flat', 'Stop before your back rounds'] }),
  stretch({ id: 'front-split', name: 'Front split progression', perSide: true, cues: ['Use blocks or cushions under your hands', 'Square the hips', 'Come out slowly, never bounce'] }),
  stretch({ id: 'quad', name: 'Quad stretch', perSide: true, cues: ['Heel to glute, knees together', 'Tuck the pelvis', 'Hold a wall for balance'] }),
  stretch({ id: 'calf', name: 'Calf stretch', perSide: true, cues: ['Heel down, toes up the wall', 'Keep the back leg straight'] }),
  stretch({ id: 'pigeon', name: 'Pigeon', perSide: true, cues: ['Front shin angled, hips square', 'Fold forward only if it feels fine', 'Ease out if the knee complains'] }),

  tech({ id: 'chamber', name: 'Chamber drill', perSide: true, cues: ['Knee up and in, foot tucked', 'Hips stay level', 'Return to the chamber, do not drop the leg'] }),
  tech({ id: 'front-kick', name: 'Front kick', perSide: true, cues: ['Chamber, then snap from the knee', 'Ball of the foot, toes back', 'Re-chamber before landing'] }),
  tech({ id: 'roundhouse', name: 'Roundhouse', perSide: true, cues: ['Pivot the standing foot', 'Hips turn over first', 'Snap the shin through the target'] }),
  tech({ id: 'side-kick', name: 'Side kick', perSide: true, cues: ['Chamber knee across the body', 'Heel leads, hip over', 'Lean back slightly, eyes on target'] }),
  tech({ id: 'hook-kick', name: 'Hook kick', perSide: true, cues: ['Extend past the target, then hook back', 'Heel drives the strike', 'Control the return'] }),
  tech({ id: 'back-kick', name: 'Back kick', perSide: true, cues: ['Look over the shoulder first', 'Chamber, then drive the heel back', 'Keep your balance on landing'] }),
  tech({ id: 'bill-wallace', name: 'Bill Wallace kick', perSide: true, cues: ['Lead leg from a sparring stance', 'Fast hip, fast snap', 'Re-chamber and return to stance'] }),

  weights({ id: 'weighted-slow-kicks', name: 'Slow controlled kicks', perSide: true, cues: ['Slow tempo, no snapping', 'Return to the chamber, do not whip back', 'Stop if the knee hurts'] }),
  weights({ id: 'weighted-chamber-hold', name: 'Chamber holds', perSide: true, cues: ['Hold the chamber steady', 'Keep your hips level', 'Lower under control'] }),
  weights({ id: 'weighted-knee-raise', name: 'Weighted knee raises', perSide: true, defaultTarget: { reps: 10, rounds: 3, restSec: 60 }, cues: ['Slow up, slower down', 'Stay tall'] }),

  bands({ id: 'band-chamber', name: 'Band-resisted chamber lift', perSide: true, cues: ['Anchor the band low', 'Lift the knee against the band', 'Slow return'] }),
  bands({ id: 'band-side-kick', name: 'Band side-kick extension', perSide: true, cues: ['Chamber, then press out against the band', 'Hold briefly at full extension'] }),
  bands({ id: 'band-abduction', name: 'Hip abduction', perSide: true, cues: ['Band above the knees', 'Lift the leg out to the side', 'Do not lean'] }),
  bands({ id: 'band-curl', name: 'Hamstring curl', perSide: true, cues: ['Band around the ankle', 'Curl the heel to the glute', 'Control the return'] }),

  bag({ id: 'bag-roundhouse', name: 'Roundhouse rounds', cues: ['Kick through the bag, not at it', 'Reset your stance between kicks'] }),
  bag({ id: 'bag-combos', name: 'Back-leg and front-leg combos', cues: ['Alternate legs', 'Keep your hands up'] }),
  bag({ id: 'bag-power', name: 'Power-kick rounds', cues: ['Fewer kicks, full power', 'Breathe out on impact'] }),

  shadow({ id: 'shadow', name: 'Shadow sparring', cues: ['Light footwork and kicks, no contact', 'Move, do not stand still'] }),

  spar({ id: 'spar-point', name: 'Point sparring rounds', needsPartner: true, cues: ['One clean scoring kick, then reset'] }),
  spar({ id: 'spar-continuous', name: 'Continuous rounds', cues: ['Keep moving and keep your guard'] }),
  spar({ id: 'spar-footwork', name: 'Footwork-only rounds', cues: ['No kicks, only movement and distance'] }),
  spar({ id: 'spar-counter', name: 'Counter drills', needsPartner: true, cues: ['Let the attack come, answer with one kick'] }),
  spar({ id: 'spar-defense', name: 'Defensive rounds', cues: ['Slip, block or step back, then counter'] }),

  plyo({ id: 'jump-squat', name: 'Jump squats', cues: ['Sit back, then explode up', 'Land soft, knees tracking toes'] }),
  plyo({ id: 'skater-jump', name: 'Skater jumps', cues: ['Leap side to side', 'Land on one leg and balance'] }),
  plyo({ id: 'tuck-jump', name: 'Tuck jumps', cues: ['Knees to chest at the top', 'Land softly'] }),
  plyo({ id: 'lunge-jump', name: 'Lunge jumps', cues: ['Switch legs in the air', 'Keep your torso upright'] }),
  plyo({ id: 'jump-rope', name: 'Jump rope', equipment: ['rope'], cues: ['Small hops on the balls of the feet', 'Wrists turn the rope'] }),
  plyo({ id: 'calf-hop', name: 'Calf hops', cues: ['Stay on the balls of your feet', 'Quick, springy contacts'] }),

  cool({ id: 'static-stretch', name: 'Static stretches', defaultTarget: { seconds: 75 }, cues: ['Easy, steady stretches', 'Breathe slowly'] }),
  cool({ id: 'breathing', name: 'Breathing', defaultTarget: { seconds: 90 }, verify: 'none', cues: ['In through the nose', 'Long breath out'] }),
];

export const exerciseById = (id: string): Exercise | undefined => EXERCISES.find((e) => e.id === id);
