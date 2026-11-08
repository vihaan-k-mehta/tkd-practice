import { useEffect, useRef, useState } from 'preact/hooks';
import { ANIMS } from './library';
import { joints, loopMs, poseAt, VIEWBOX, type Anim, type Pt } from './skeleton';

const pts = (...p: Pt[]) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Figure({ anim, t }: { anim: Anim; t: number }) {
  const p = poseAt(anim, t);
  const j = joints(p, anim.view);
  const has = (k: string) => anim.props.includes(k as never);
  const weights = has('weights');
  const ankle = (leg: Pt[]) => leg[2];
  const phase = (t % 440) / 440;
  return (
    <svg viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`} role="img" aria-label={anim.label} class="figure">
      <line x1="4" x2="116" y1="112" y2="112" class="fig-floor" />
      {has('wall') && <line x1="110" x2="110" y1="0" y2="112" class="fig-prop" />}
      {has('bag') && (<><line x1="110" x2="110" y1="-14" y2="34" class="fig-prop" /><rect x="103" y="34" width="14" height="60" rx="6" class="fig-bag" /></>)}
      {has('rope') && (() => {
        const hands = j.nearArm[2];
        const swing = Math.cos(phase * Math.PI * 2);
        const lowY = 8 + (112 - 8) * (0.5 + 0.5 * swing);
        return <path d={`M ${hands[0]} ${hands[1]} Q ${hands[0] + 22} ${lowY} ${hands[0] - 8} ${lowY * 0.9 + 4}`} class="fig-rope" fill="none" />;
      })()}
      {has('band') && <line x1={ankle(j.farLeg)[0]} y1={ankle(j.farLeg)[1]} x2={ankle(j.nearLeg)[0]} y2={ankle(j.nearLeg)[1]} class="fig-band" />}
      <g class="fig-far">
        <polyline points={pts(...j.farLeg)} />
        <polyline points={pts(...j.farArm)} />
      </g>
      <polyline points={pts(j.hip, j.neck)} class="fig-body" />
      <circle cx={j.head[0]} cy={j.head[1]} r="7" class="fig-head" />
      <g class="fig-near">
        <polyline points={pts(...j.nearLeg)} />
        <polyline points={pts(...j.nearArm)} />
      </g>
      {weights && [j.nearLeg, j.farLeg].map((l) => <circle cx={l[2][0]} cy={l[2][1]} r="3.6" class="fig-weight" />)}
    </svg>
  );
}

export function ExerciseAnim({ id, size = 'large' }: { id: string; size?: 'large' | 'small' }) {
  const anim = ANIMS[id];
  const [t, setT] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!anim || reduced()) return;
    const start = performance.now();
    const tick = (now: number) => { setT(now - start); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [id]);
  if (!anim) return null;
  // With reduced motion, show the most extended moment instead of moving.
  const shown = reduced() ? loopMs(anim) * 0.45 : t;
  return <div class={`anim ${size}`}><Figure anim={anim} t={shown} /></div>;
}
