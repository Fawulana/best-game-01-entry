// The six levels, each a hand-built pattern of crystal bricks. One character per brick:
//   '.'  empty
//   '1'  a crystal of 1 hit
//   '2'  a crystal of 2 hits
//   '3'  a crystal of 3 hits
//   'X'  steel: never breaks, the ball bounces off it
//   'E'  an ember brick: 1 hit, and breaking it scorches its neighbours for 1 hit each
//   'B'  a bonus crystal: 1 hit, and always drops a powerup
// Every row is BRICK.cols characters wide. The patterns are data, not code: the world
// builds the same bricks from them on every run, so a level is identical for every player.

export const LEVELS = [
  {
    name: 'First Light',
    sub: 'Warm up. Shatter every crystal.',
    rows: [
      '..............',
      '.111111111111.',
      '.111111111111.',
      '..1111111111..',
    ],
  },
  {
    name: 'Checker Dawn',
    sub: 'Two-hit crystals join the field.',
    rows: [
      '.121212121212.',
      '12121212121212',
      '.212121212121.',
      '..2222222222..',
    ],
  },
  {
    name: 'Prism Peak',
    sub: 'Gold crystals take three hits.',
    rows: [
      '......11......',
      '.....1221.....',
      '....123321....',
      '...1233321....',
      '..123333321...',
      '.122333333221.',
    ],
  },
  {
    name: 'Iron Gate',
    sub: 'Steel never breaks. Bonus crystals always drop a powerup.',
    rows: [
      'X111111111111X',
      'X122222222221X',
      'X12BBBBBBBB21X',
      'X122222222221X',
      'X111111111111X',
    ],
  },
  {
    name: 'Ember Fort',
    sub: 'Ember bricks scorch their neighbours when they break.',
    rows: [
      '..X..E..E..X..',
      '.122222222221.',
      '12E22222222E21',
      '12233333333221',
      '.122222222221.',
      '..X..E..E..X..',
    ],
  },
  {
    name: 'The Crown',
    sub: 'The last wall. Clear it and the sky is yours.',
    rows: [
      'X333333333333X',
      'X322222222223X',
      'X321111111123X',
      'X321B2222B123X',
      'X321111111123X',
      'X322222222223X',
      'X333333333333X',
    ],
  },
];
