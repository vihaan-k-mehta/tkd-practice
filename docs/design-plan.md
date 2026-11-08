# Design plan: TKD Practice, milestones 1 and 2

## Palette
Tokens from the guide: mat #F4F6F8, surface #FFF, ink #1C2733, muted #5B6773, line #D5DADF,
hong (red, primary action) #C23B32, chung (blue, progress) #2A5DA8, belt (gold, streak only) #D9A21B.
Dark mode via prefers-color-scheme with the guide's dark values. White text on hong is 5.1:1, fine for 56px buttons.

## Type
Archivo variable, self-hosted. Condensed bold (wdth 75, wght 800) for titles, regular (wdth 100) for body,
extended (wdth 125) for numerals. Scale 14/16/20/28/40, timer 96-140. Body never under 16 (14 only for tab labels).

## Layout (390x844)
    +------------------------------+
    | Today                    (o) |  title left, settings gear right
    |------------------------------|
    | NEXT SESSION -> "Next session" plain label
    | Kick day with Bill Wallace   |  28px condensed
    | 42 min, 9 blocks             |
    | [        Start session      ]|  56px, hong, full width
    |------------------------------|
    | Streak            6 days     |  rows, hairline dividers
    | Week quest        3 of 4     |  thin chung progress bar
    | Bill Wallace      Level 1    |
    |------------------------------|
    | Today  Routines  Schedule  Quests  Ranks |
    +------------------------------+

## The one memorable thing
A belt strip: a 6px gold bar under the title whose length is streak progress toward the next belt.
It is the only gold on the screen. Nothing else is decorative.

## AI-tell check
- cream+serif+terracotta: no, cool grey/white, sans only
- neon on near-black: no, dark mode is slate with muted red/blue
- gradients/glass/blobs: none
- identical rounded cards: none, plain rows with hairlines
- caps eyebrows, middle dots, arrows: none (labels are sentence case, meta uses commas)
- one coloured/italic headline word: none
- emoji, fake stats, testimonials: none; data is clearly placeholder and labelled in code
- fade/slide on load: none
Result: zero trips. Motion only for tab press feedback (none) and reduced-motion respected.
