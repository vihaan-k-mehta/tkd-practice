# TKD Practice

Phone-first taekwondo practice PWA. Vite + TypeScript + Preact, hosted on GitHub Pages.

Status: milestones 1 and 2 (scaffold, deploy workflow, design system, Today screen with static data).

    npm install
    npm run dev      # local, on your network
    npm test         # vitest
    npm run shots    # Playwright screenshots into ./screenshots
    npm run build

Vite `base` is `/tkd-practice/` (vite.config.ts). If you name the repo differently, change it there and in index.html.
Design plan: docs/design-plan.md

## Training data and tuning

Settings, Training data lists every exercise. Record about 5 reps of each in front of the camera. It stores body points only (no video), tunes the tracker to how you do that exercise, and saves a copy to your account when you are signed in.

To have the tracker looked at: Settings, Training data, Download my data. That makes `tkd-training-data.json`. Then run

    npx tsx scripts/analyze-samples.ts path/to/tkd-training-data.json

It prints, per exercise, how many reps the standard tracker counted against how many a tuned tracker counted, and the settings that would fix it. `scripts/make-demo-export.ts` writes a made-up file to try it on.

Database setup lives in `supabase/migrations`: run `0001_profiles.sql` then `0002_sync.sql` once in the Supabase SQL editor.
