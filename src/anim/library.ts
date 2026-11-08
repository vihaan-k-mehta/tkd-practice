import { DEFAULT_POSE, type Anim, type Pose, type Prop, type View } from './skeleton';

type P = Partial<Pose>;
const G: P = { ns: 35, ne: 105, fs: 20, fe: 110 }; // guard hands
const SIT: P = { y: 46 }; // hips on the floor
const CH: P = { nh: 95, nk: 105 }; // chamber
const EX: P = { nh: 88, nk: 4 }; // extended kick
const A = (label: string, base: P, frames: [number, P][], props: Prop[] = [], view: View = 'side'): Anim => ({
  label, view, props: ['floor', ...props],
  frames: frames.map(([ms, p]) => ({ ms, pose: { ...DEFAULT_POSE, ...base, ...p } })),
});

/** One simplified drawing per exercise id. Side view unless noted. */
export const ANIMS: Record<string, Anim> = {
  'leg-swing-front': A('Swing the leg forward and back, hand on a wall', { ns: 70, ne: 10 }, [[900, { nh: -25 }], [900, { nh: 75 }]], ['wall']),
  'leg-swing-side': A('Swing the leg out and across your body', { ns: 20, fs: 20 }, [[900, { nh: -18 }], [900, { nh: 42 }]], [], 'front'),
  'hip-circles': A('Lift the knee and draw a big circle', { ...G }, [[700, { nh: 85, nk: 95 }], [700, { nh: 60, nk: 70 }], [700, { nh: 35, nk: 95 }], [700, { nh: 60, nk: 120 }]]),
  'knee-raises': A('Drive one knee up, then the other', { ...G }, [[600, { nh: 95, nk: 100 }], [600, { nh: 0, nk: 0 }], [600, { fh: 95, fk: 100 }], [600, { fh: 0, fk: 0 }]]),
  'ankle-circles': A('Circle the ankle slowly', { nh: 45, nk: 30, ns: 10, fs: -5 }, [[600, { nf: 55, nh: 70, nk: 20 }], [600, { nf: 0, nh: 45, nk: 45 }], [600, { nf: -75, nh: 70, nk: 20 }], [600, { nf: 0, nh: 35, nk: 30 }]]),
  'hamstring': A('Hinge forward from the hips, back flat', { ...SIT, nh: 90, fh: 90, ns: 10 }, [[2200, { tor: 5, ns: 20 }], [2200, { tor: 60, ns: 75 }]]),
  'hip-flexor': A('Back knee down, push the hips forward', { y: 24, nh: 90, nk: 90, fh: -5, fk: 90, ff: -85, ns: 140, ne: 0, fs: 140, fe: 0 }, [[2000, { tor: 0, x: 0, ns: 120, fs: 120 }], [2000, { tor: 14, x: 7, ns: 175, fs: 175 }]]),
  'butterfly': A('Soles together, let the knees drop', { ...SIT, y: 43, ns: 15, fs: 15 }, [[1600, { nh: 108, nk: 183, fh: 108, fk: 183, fold: 0, ns: 20, fs: 20 }], [1600, { nh: 94, nk: 169, fh: 94, fk: 169, fold: 0.6, ns: 60, fs: 60 }]], [], 'front'),
  'straddle': A('Legs wide, walk the hands forward', { ...SIT, y: 44, nh: 84, fh: 84, ns: 20, fs: 20 }, [[2200, { fold: 0 }], [2200, { fold: 0.9, ns: 55, fs: 55 }]], [], 'front'),
  'front-split': A('Sink slowly, hips square', { x: 6, nh: 90, fh: -85, ff: -90 }, [[2600, { y: 34, tor: 0, ns: 35, fs: 35 }], [2600, { y: 45, tor: 18, ns: 80, fs: 80 }]]),
  'quad': A('Heel toward the glute, knees together', { nh: 0, ns: -35, ne: 70, fs: 70, fe: 10 }, [[1800, { nk: 85, tor: 0 }], [1800, { nk: 150, tor: 6 }]], ['wall']),
  'calf': A('Hands on the wall, back heel down', { y: 4, nh: 40, nk: 52, fh: -25, ns: 75, ne: 5, fs: 75, fe: 5 }, [[2000, { tor: 6, nh: 30, nk: 40 }], [2000, { tor: 28, nh: 52, nk: 78 }]], ['wall']),
  'pigeon': A('Fold forward over the front leg', { ...SIT, x: 3, nh: 95, nk: 180, fh: -85, ff: -90, ns: 40, fs: 40 }, [[2400, { tor: 5, ns: 40 }], [2400, { tor: 48, ns: 65 }]]),
  'chamber': A('Knee up and in, then back down', { ...G }, [[700, { ...CH }], [500, { ...CH }], [700, { nh: 0, nk: 0 }], [500, { nh: 0, nk: 0 }]]),
  'front-kick': A('Chamber, snap the leg out, re-chamber', { ...G }, [[500, { ...CH }], [200, { ...EX }], [300, { ...CH }], [600, { nh: 0, nk: 0 }]]),
  'roundhouse': A('Chamber, turn the hip over, snap, re-chamber', { ...G, tor: -4 }, [[550, { ...CH, tor: -6 }], [220, { nh: 85, nk: 6, tor: -16 }], [300, { ...CH, tor: -6 }], [650, { nh: 0, nk: 0, tor: -2 }]]),
  'side-kick': A('Knee up, then push the heel out to the side', { x: -8, ns: 20, fs: 20 }, [[550, { nh: 60, nk: 110, tor: -6 }], [250, { nh: 86, nk: 4, tor: -22 }], [350, { nh: 60, nk: 110, tor: -6 }], [650, { nh: 0, nk: 0, tor: 0 }]], [], 'front'),
  'hook-kick': A('Extend, then hook the heel back', { ...G }, [[550, { ...CH }], [240, { ...EX }], [260, { nh: 85, nk: 75, nf: -10 }], [300, { ...CH }], [550, { nh: 0, nk: 0 }]]),
  'back-kick': A('Turn, look back, thrust the heel straight back', { ns: 40, ne: 100, fs: 30, fe: 100 }, [[600, { tor: 20 }], [350, { tor: 52, nh: -18, nk: 90 }], [220, { tor: 62, nh: -86, nk: 4 }], [400, { tor: 40, nh: -18, nk: 90 }], [600, { tor: 0 }]]),
  'bill-wallace': A('Fast lead-leg roundhouse: snap out and straight back', { ...G, tor: -4 }, [[300, { nh: 92, nk: 100, tor: -8 }], [120, { nh: 84, nk: 6, tor: -16 }], [160, { nh: 92, nk: 100, tor: -8 }], [500, { nh: 0, nk: 0, tor: -2 }]]),
  'bill-wallace-routine': A('Hold the leg out high, then slow and fast kicks without the foot touching down', { ...G, tor: -6 }, [[1200, { nh: 106, nk: 2 }], [1600, { nh: 108, nk: 2 }], [700, { ...CH }], [260, { nh: 88, nk: 5, tor: -14 }], [380, { ...CH }], [260, { nh: 88, nk: 5, tor: -14 }], [380, { ...CH }], [800, { nh: 0, nk: 0, tor: -2 }]]),
  'weighted-slow-kicks': A('Kick out slowly, control the way back', { ...G }, [[1400, { ...CH }], [1600, { ...EX }], [1600, { ...CH }], [1200, { nh: 0, nk: 0 }]], ['weights']),
  'weighted-chamber-hold': A('Hold the chamber without dropping the knee', { ...G }, [[1000, { ...CH }], [2000, { nh: 98, nk: 108 }], [1000, { ...CH }], [900, { nh: 0, nk: 0 }]], ['weights']),
  'weighted-knee-raise': A('Lift the weighted knee slowly', { ...G }, [[1600, { nh: 95, nk: 100 }], [1600, { nh: 0, nk: 0 }]], ['weights']),
  'band-chamber': A('Lift the knee against the band', { ...G }, [[1300, { ...CH }], [1300, { nh: 0, nk: 0 }]], ['band']),
  'band-side-kick': A('Extend the leg out against the band', { ns: 20, fs: 20 }, [[1200, { nh: 60, nk: 110 }], [1200, { nh: 70, nk: 5 }]], ['band'], 'front'),
  'band-abduction': A('Lift the leg out to the side against the band', { ns: 20, fs: 20 }, [[1300, { nh: 5 }], [1300, { nh: 38 }]], ['band'], 'front'),
  'band-curl': A('Curl the heel toward the glute against the band', { ns: 40, ne: 90, fs: 20, fe: 90 }, [[1300, { nk: 0 }], [1300, { nk: 110 }]], ['band']),
  'bag-roundhouse': A('Roundhouse into the bag, reset, repeat', { ...G, tor: -4 }, [[500, { ...CH, tor: -6 }], [200, { nh: 85, nk: 6, tor: -16 }], [260, { ...CH, tor: -6 }], [700, { nh: 0, nk: 0, tor: -2 }]], ['bag']),
  'bag-combos': A('Back leg, then front leg, into the bag', { ...G }, [[450, { ...CH }], [200, { ...EX }], [300, { nh: 0, nk: 0 }], [450, { fh: 95, fk: 105 }], [200, { fh: 88, fk: 4 }], [350, { fh: 0, fk: 0 }]], ['bag']),
  'bag-power': A('Drive the hips and kick through the bag', { ...G, x: -2 }, [[700, { ...CH, tor: 0 }], [260, { nh: 82, nk: 4, tor: -20, x: 5 }], [500, { ...CH, tor: 0, x: 0 }], [900, { nh: 0, nk: 0, x: -2 }]], ['bag']),
  'shadow': A('Bounce, then flow into kicks', { ...G }, [[350, { y: 0 }], [350, { y: -3 }], [350, { y: 0 }], [250, { ...CH }], [180, { ...EX }], [250, { ...CH }], [300, { nh: 0, nk: 0, y: 0 }], [350, { y: -3 }]]),
  'spar-point': A('Step in, kick, step out', { ...G }, [[400, { nh: 25, fh: -15, y: 0 }], [400, { nh: -10, fh: 12, y: 0 }], [260, { ...CH }], [160, { ...EX }], [240, { ...CH }], [500, { nh: 0, nk: 0, fh: -18, y: 0 }]]),
  'spar-continuous': A('Stay light and keep kicking', { ...G }, [[300, { y: 0 }], [250, { ...CH }], [160, { ...EX }], [250, { nh: 0, nk: 0 }], [250, { fh: 95, fk: 105 }], [160, { fh: 88, fk: 4 }], [300, { fh: 0, fk: 0, y: 0 }]]),
  'spar-footwork': A('Light steps, weight on the balls of the feet', { ...G }, [[260, { nh: 28, fh: -18, y: 0 }], [260, { nh: 0, fh: 0, y: -1 }], [260, { nh: -18, fh: 28, y: 0 }], [260, { nh: 0, fh: 0, y: -1 }]]),
  'spar-counter': A('Step back, block, counter-kick', { ...G }, [[400, { tor: 8, nh: -16, fh: 14 }], [350, { ns: 60, ne: 125, fs: 50, fe: 120, tor: 4 }], [250, { ...CH, ...G }], [160, { ...EX }], [500, { nh: 0, nk: 0 }]]),
  'spar-defense': A('Bob, weave and block with the shin', { ns: 60, ne: 120, fs: 55, fe: 120 }, [[450, { tor: 18, y: 0 }], [450, { tor: -8, y: 0 }], [350, { nh: 80, nk: 100, tor: 0 }], [450, { nh: 0, nk: 0, tor: 12, y: 0 }]]),
  'jump-squat': A('Squat down, explode up, land soft', { ns: 20, ne: 100, fs: 20, fe: 100 }, [
    [600, { y: 19, tor: 28, nh: 70, nk: 100, fh: 70, fk: 100, ns: 55, ne: 20, fs: 55, fe: 20 }],
    [250, { y: -18, tor: 0, nh: 0, nk: 0, fh: 0, fk: 0, ns: 130, ne: 10, fs: 130, fe: 10, nf: -50, ff: -50 }],
    [350, { y: 0, tor: 0, nh: 0, nk: 0, fh: 0, fk: 0, ns: 20, ne: 100, fs: 20, fe: 100 }]]),
  'skater-jump': A('Leap sideways, land on one leg', { ns: 25, ne: 40, fs: 25, fe: 40 }, [
    [350, { x: -16, y: 0, tor: -12, nh: -14, nk: 60, fh: 0, fk: 20 }],
    [250, { x: 0, y: -10, tor: 0, nh: 6, nk: 20, fh: 6, fk: 20 }],
    [350, { x: 16, y: 0, tor: 12, fh: 14, fk: 60, nh: 0, nk: 20 }],
    [250, { x: 0, y: -10, tor: 0, nh: 6, nk: 20, fh: 6, fk: 20 }]], [], 'front'),
  'tuck-jump': A('Jump and pull both knees to the chest', { ns: 20, ne: 100, fs: 20, fe: 100 }, [
    [450, { y: 10, tor: 12, nh: 40, nk: 70, fh: 40, fk: 70 }],
    [260, { y: -20, tor: 8, nh: 95, nk: 110, fh: 95, fk: 110, ns: 50, ne: 80, fs: 50, fe: 80 }],
    [380, { y: 0, tor: 0 }]]),
  'lunge-jump': A('Jump and switch legs in the air', { ns: 30, ne: 100, fs: 30, fe: 100 }, [
    [450, { y: 20, tor: 6, nh: 80, nk: 85, fh: -30, fk: 90 }],
    [260, { y: -18, tor: 0, nh: 20, nk: 40, fh: 20, fk: 40 }],
    [450, { y: 20, tor: 6, nh: -30, nk: 90, fh: 80, fk: 85 }],
    [260, { y: -18, tor: 0, nh: 20, nk: 40, fh: 20, fk: 40 }]]),
  'jump-rope': A('Small hops, wrists turn the rope', { ns: 12, ne: 85, fs: 12, fe: 85 }, [[220, { y: -10, nf: -45, ff: -45, ns: 30, fs: 30, ne: 60, fe: 60 }], [220, { y: 0, nf: 0, ff: 0, ns: 12, fs: 12, ne: 100, fe: 100 }]], ['rope']),
  'calf-hop': A('Bounce on the balls of the feet, legs straight', { ns: 10, fs: 10 }, [[260, { y: -14, nf: -70, ff: -70, ns: 30, fs: 30 }], [260, { y: 0, nf: 0, ff: 0, ns: 10, fs: 10 }]]),
  'static-stretch': A('Fold forward and let the arms hang', { ns: 5, ne: 5, fs: 5, fe: 5 }, [[2400, { tor: 5 }], [2600, { tor: 78, ns: 8, fs: 8 }]]),
  'breathing': A('Breathe in as the arms rise, out as they lower', { ns: 5, ne: 5, fs: 5, fe: 5 }, [[4000, { ns: 165, ne: 5, fs: 165, fe: 5 }], [4000, { ns: 5, ne: 5, fs: 5, fe: 5 }]]),
};
