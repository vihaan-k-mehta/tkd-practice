import { EXERCISES } from '../data/exercises';
import { Figure } from '../anim/ExerciseAnim';
import { ANIMS } from '../anim/library';
import { loopMs } from '../anim/skeleton';

/** Review page (not linked): still frames from every animation. */
export function AnimSheet() {
  return (
    <main class="screen">
      <h1>Animations</h1>
      <div class="anim-grid">
        {EXERCISES.map((e) => {
          const a = ANIMS[e.id]; const total = loopMs(a);
          return (
            <section class="anim-cell" data-id={e.id}>
              <b>{e.name}</b>
              <div class="anim-frames">{[0.12, 0.3, 0.5, 0.7].map((f) => <div class="anim small"><Figure anim={a} t={total * f} /></div>)}</div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
