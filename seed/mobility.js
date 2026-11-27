// Warm-up, stretching and mobility lists. Generic content; each entry is [what, how much].
export const WARMUP = {
  UPPER: [
    ['Arm circles', '10 forward, 10 back'],
    ['Shoulder dislocations, band or broomstick', '15'],
    ['Cat-cow', '10'],
    ['Wall slides', '10'],
    ['Band pull-aparts', '15'],
    ['Wrist circles', '10 each way'],
  ],
  LOWER: [
    ['Leg swings', '10 front to back, 10 side to side, each leg'],
    ['Hip circles', '10 each way'],
    ['Walking knee hugs', '10 each leg'],
    ['Walking quad stretch', '10 each leg'],
    ['Bodyweight squats', '10'],
    ['Glute bridges', '15'],
  ],
};

// 30 to 60 seconds once a lift is finished, on the way to the next one.
const CHEST = 'Doorway chest stretch', REACH = 'Overhead reach', WRIST = 'Wrist flexor and extensor stretch', QUAD = 'Standing quad stretch', HIP = 'Hip flexor stretch', CALF = 'Calf stretch';
const AFTER = {
  bench: CHEST, inclinedb: CHEST, ohp: CHEST, row: REACH, pullup: REACH, shrug: REACH,
  curl: WRIST, wristcurl: WRIST, fingercurl: WRIST,
  squat: HIP, sldl: QUAD, hipthrust: QUAD, legext: QUAD, legcurl: QUAD, toeraise: CALF,
};
// Between sets of the same lift.
const DURING = { toeraise: CALF };
export function stretchAfter(ex, dayType) { return ex === 'chestpull' ? (dayType === 'LOWER' ? AFTER.squat : null) : AFTER[ex] || null; }
export function stretchDuring(ex) { return DURING[ex] || null; }

export const COOLDOWN = [
  ["Child's pose", '1 min'],
  ['Pigeon pose', '1 min each side'],
  ['Seated spinal twist', '30 s each side'],
  ['Hamstring stretch', '1 min each leg'],
  ['Doorway chest stretch', '1 min'],
  ['Cat-cow', '1 min'],
];
// After Fat Gripz and grip work.
export const GRIP = [
  ['Prayer stretch', 'hands together, push down'],
  ['Reverse prayer', 'backs of the hands together'],
  ['Finger stretches', 'one finger at a time'],
];
export const MORNING = [
  ['Shoulder blade squeezes', '15'],
  ['Neck rolls', '5 each way'],
  ['Standing backbend', '10'],
  ['Hip circles', '10 each way'],
  ['Ankle circles', '10 each way'],
];
export const EVENING = [
  ['Forward fold', '2 min'],
  ['Figure-4 hip stretch', '1 min each side'],
  ['Supine spinal twist', '1 min each side'],
  ['Chest stretch', '2 min'],
  ['Neck stretch', '30 s each direction'],
  ["Deep breathing in child's pose", '2 min'],
];
// The four that are done every day, whatever else is skipped.
export const DAILY_FOUR = ['Hip flexors', 'Chest and front delts', 'Upper back', 'Glute activation'];
