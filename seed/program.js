// Generic program data. No personal loads live here: they come from T's own log on the phone.
const R = { SQUAT: 'BREATHING_SQUAT', DOUBLE: 'DOUBLE_PROGRESSION', BW: 'BODYWEIGHT_REPS', UNW: 'UNWEIGHTED', PROTO: 'PROTOCOL' };
const heavy = { rest: 120, trans: 180 }, iso = { rest: 90, trans: 120 }, small = { rest: 60, trans: 90 };

export const EXERCISES = {
  squat:      { name: 'Parallel squats',       equip: 'barbell',  rule: R.SQUAT,  inc: 2.5, rest: 0, trans: 180, plates: true, warm: true },
  chestpull:  { name: 'Rader chest pulls',     equip: 'none',     rule: R.UNW,    ...small },
  sldl:       { name: 'Straight-leg deadlift', equip: 'barbell',  rule: R.DOUBLE, inc: 2.5, ...heavy, plates: true },
  hipthrust:  { name: 'Hip thrusts',           equip: 'barbell',  rule: R.DOUBLE, inc: 2.5, ...heavy, plates: true },
  legext:     { name: 'Leg extensions',        equip: 'machine',  rule: R.PROTO,  inc: 2.5, ...iso },
  toeraise:   { name: 'Toe raises',            equip: 'machine',  rule: R.DOUBLE, inc: 2.5, ...small },
  situp:      { name: '45° decline sit-ups',   equip: 'bodyweight', rule: R.BW,   inc: 2.5, ...small },
  elbowknee:  { name: '45° elbow-to-knee',     equip: 'bodyweight', rule: R.BW,   inc: 2.5, ...small },
  bench:      { name: 'Bench press',           equip: 'barbell',  rule: R.DOUBLE, inc: 2.5, ...heavy, plates: true, warm: true, jump: 5 },
  inclinedb:  { name: 'Incline dumbbell press', equip: 'dumbbell', rule: R.DOUBLE, inc: 2, ...heavy, each: true },
  ohp:        { name: 'Overhead press',        equip: 'barbell',  rule: R.DOUBLE, inc: 2.5, ...heavy, plates: true },
  lateral:    { name: 'Lateral raises',        equip: 'dumbbell', rule: R.DOUBLE, inc: 2, ...iso, each: true, start: 6 },
  row:        { name: 'Bent-over rows',        equip: 'barbell',  rule: R.DOUBLE, inc: 2.5, ...heavy, plates: true },
  pullup:     { name: 'Wide-grip pull-ups',    equip: 'bodyweight', rule: R.BW,   inc: 2.5, ...heavy },
  pullover:   { name: 'Dumbbell pullover',     equip: 'dumbbell', rule: R.DOUBLE, inc: 2, ...iso, start: 12 },
  curl:       { name: 'Standing barbell curls', equip: 'barbell', rule: R.DOUBLE, inc: 2.5, ...iso },
  skull:      { name: 'Skull crushers',        equip: 'barbell',  rule: R.DOUBLE, inc: 2.5, ...iso },
  wristcurl:  { name: 'Wrist curls',           equip: 'barbell',  rule: R.DOUBLE, inc: 2.5, ...small },
  fingercurl: { name: 'Finger curls',          equip: 'barbell',  rule: R.DOUBLE, inc: 2.5, ...small },
  shrug:      { name: 'Shrugs',                equip: 'barbell',  rule: R.DOUBLE, inc: 2.5, ...iso, plates: true, cue: 'Barbell or dumbbells. Heavy and controlled, short pause at the top.' },
  legcurl:    { name: 'Seated leg curl',       equip: 'machine',  rule: R.DOUBLE, inc: 2.5, ...iso, cue: 'Direct knee-bending work for the hamstrings.' },
  facepull:   { name: 'Face pulls',            equip: 'cable',    rule: R.DOUBLE, inc: 2.5, ...small, cue: 'Or rear-delt raises. For the back of the shoulders.' },
  neckcurl:   { name: 'Lying neck curl',       equip: 'plate',    rule: R.DOUBLE, inc: 1.25, ...small, start: 2.5, cue: 'On your back on a bench. Folded towel and a light plate on your forehead.' },
  neckext:    { name: 'Lying neck extension',  equip: 'plate',    rule: R.DOUBLE, inc: 1.25, ...small, start: 2.5, cue: 'Face down, plate on the back of your head. Or a neck harness.' },
  neckside:   { name: 'Side neck raise',       equip: 'plate',    rule: R.DOUBLE, inc: 1.25, ...small, start: 2.5, cue: 'Lying on your side, light plate. One set is both sides. The second set is optional.' },
};

const FG = 'Fat Gripz';
export const TEMPLATES = [
  { id: 'lower', name: 'Lower Body Day', dayType: 'LOWER', items: [
    { ex: 'squat', sets: 1, reps: 20, linkedToNext: true },
    { ex: 'chestpull', sets: 2, reps: 20 },
    { ex: 'sldl', sets: 1, reps: 15 },
    { ex: 'hipthrust', sets: 3, reps: 20 },
    { ex: 'legext', protocol: 'legext5' },
    { ex: 'legcurl', sets: 3, reps: 12, top: 15 },
    { ex: 'toeraise', sets: 3, reps: 20 },
    { ex: 'situp', sets: 3, reps: 20 },
    { ex: 'elbowknee', sets: 2, reps: 20 },
    { ex: 'neckcurl', sets: 2, reps: 15, top: 25 },
    { ex: 'neckext', sets: 2, reps: 15, top: 25 },
    { ex: 'neckside', sets: 2, reps: 15, top: 20 },
  ] },
  { id: 'upper-revised', name: 'Upper Body Day (revised)', dayType: 'UPPER', items: [
    { ex: 'bench', sets: 3, reps: 12 },
    { ex: 'inclinedb', sets: 3, reps: 12 },
    { ex: 'ohp', variant: FG, sets: 3, reps: 10 },
    { ex: 'lateral', sets: 3, reps: 15 },
    { ex: 'row', sets: 2, reps: 15 },
    { ex: 'shrug', sets: 3, reps: 12, top: 15 },
    { ex: 'pullup', sets: 3, reps: 12 },
    { ex: 'pullover', sets: 3, reps: 12 },
    { ex: 'facepull', sets: 2, reps: 15, optional: true },
    { ex: 'curl', variant: FG, sets: 3, reps: 12 },
    { ex: 'skull', sets: 3, reps: 12 },
    { ex: 'wristcurl', sets: 2, reps: 20 },
  ] },
  { id: 'upper-logged', name: 'Upper Body Day (as logged)', dayType: 'UPPER', items: [
    { ex: 'ohp', variant: FG, sets: 3, reps: 10 },
    { ex: 'bench', variant: FG, sets: 3, reps: 12 },
    { ex: 'row', sets: 2, reps: 15 },
    { ex: 'shrug', sets: 3, reps: 12, top: 15 },
    { ex: 'pullup', sets: 3, reps: 12 },
    { ex: 'facepull', sets: 2, reps: 15, optional: true },
    { ex: 'inclinedb', sets: 3, reps: 12 },
    { ex: 'curl', variant: FG, sets: 3, reps: 12 },
    { ex: 'skull', sets: 3, reps: 12 },
    { ex: 'chestpull', sets: 2, reps: 20 },
    { ex: 'fingercurl', sets: 3, reps: 20 },
    { ex: 'wristcurl', sets: 3, reps: 20 },
  ] },
];

// Lifts added to the built-in routines after they first shipped: [routine, lift, the lift it follows (null = at the end)].
// A routine T has already edited on the phone gets them once, in the same place (see js/program.js).
export const ADDED = { rev: 2, items: [
  ['lower', 'legcurl', 'legext'], ['lower', 'neckcurl', null], ['lower', 'neckext', null], ['lower', 'neckside', null],
  ['upper-revised', 'shrug', 'row'], ['upper-revised', 'facepull', 'pullover'],
  ['upper-logged', 'shrug', 'row'], ['upper-logged', 'facepull', 'pullup'],
] };

// Leg-extension protocol (brief §5.2). hold: seconds, 'max' (as long as possible) or null.
export const PROTOCOLS = {
  legext5: [
    { label: 'Warm-up', reps: 15, hold: null, rest: 60 },
    { label: '', reps: 20, hold: null, rest: 60 },
    { label: '', reps: 25, hold: 20, rest: 60 },
    { label: '', reps: 20, hold: null, rest: 60 },
    { label: '', reps: 15, hold: 'max', rest: 0 },
  ],
};

export const POWER = 'One more makes me immortal.';
export const PILLARS = [
  'One set. All of me.',
  'Reps one to ten warm the body. Eleven to twenty build the man.',
  'Breathe. Squat. Rise.',
  'Two and a half kilos. Every session. No exceptions.',
  'The mind finishes what the legs begin.',
  'The bar gets heavier. So do I.',
  'The milk is part of the training.',
  'Growth happens at rest. Rest like you mean it.',
  'Eat like it is your job.',
  'A big chest is built from the legs up.',
  'Achilles was forged, not found.',
  "Today's last rep is tomorrow's first warm-up.",
];
// Cues under the bar, one per 30 s; from 2:00 the power phrase stays.
export const SQUAT_CUES = [PILLARS[0], PILLARS[2], PILLARS[1], PILLARS[4]];
