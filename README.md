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
