/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: RC.TITLE, // the name lives in js/title.js
  cols: ['1 player', '2 players: Teddy', '2 players: Tommy'],
  keys: [
    ['walk', '← → or A D', 'A D', '← →'],
    ['throw a rainbow the way you face', 'Space or X', 'Space or F', 'Enter or L'],
    ['jump', '↑ or W', 'W', '↑'],
    ['break the rainbow you stand on', '↓ or S', 'S', '↓'],
    ['call your brother: a giant rainbow staircase (2 players: high five)', 'T', 'T', 'T'],
    ['pause · sound', 'P or Esc · M', 'P · M', 'P · M'],
    ['title: 1 or 2 players · easy · normal · climber · island', '1 2 · E · N · C · ← →', '', ''],
  ],
  note: 'Throw a rainbow, walk up it, and throw the next one from the top. Rainbows bonk the critters they land on (they turn into fruit). Jump on a rainbow to break it and drop it on the critters below (they drop gems). Collect all 7 gems for a bonus. The water keeps rising, so keep climbing to the treasure at the top! Call your brother as often as you like.',
  touch: '◀ ▶ walk, 🌈 throws a rainbow, ⤴️ jumps (jump on a rainbow to break it), and your brother\'s face calls him. 2 players: a pad each.',
});
