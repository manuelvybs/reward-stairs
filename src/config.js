// Reward Stairs — tuning, palette and copy in one place.
export const GAME = {
  title: 'Reward Stairs',
  controls: '← → walk · Space jump · M sound',
  controlsTouch: 'hold ◀ ▶ to walk · tap ⤒ to jump',
  // TODO: swap in the Singular link when there is one
  store: {
    ios: 'https://apps.apple.com/us/app/vybs-steps-walk-earn/id6784293036',
    android: 'https://play.google.com/store/apps/details?id=co.vybs.app',
    web: 'https://vybs.co',
  },
};

export const T = {
  g: 16, jumpV: 6.6, speed: 2.15, acc: 10, airAcc: 7,
  stepUp: 0.34, airStepUp: 0.45, stepDown: 0.45,   // small rises are climbed on their own, in the air too
  foot: 0.2, platFoot: 0.24, platSnap: 0.42,       // feet a little wider than the body; hover-cards catch you a bit low
  coyote: 0.12, jumpBuf: 0.15, magnetR: 1.1, magnetV: 1.9,
  heroHeight: 1.15, chest: 0.62,
};

export const PAL = {
  fogDusk: '#e2b9d4', fogNight: '#5b4fa8',
  belowDusk: '#f0c6d2', belowNight: '#4a3f99',
  hemiSky: '#c9c4ff', hemiGround: '#3a2f7c',
  keyDusk: '#ffd2bd', keyNight: '#b9c3ff',
  rimDusk: '#ff9fcf', rimNight: '#8f7dff',
  step: '#cfc8f0', stepEdge: '#ffd98a',
  rockTop: '#9a93d4', rockSide: '#5a56a3', rockBottom: '#332f72', rockBounce: '#c493c4',
  crystals: ['#86e9ff', '#b597ff', '#ff9edb', '#fff0a8'],
  cloudNight: [0.66, 0.64, 0.92],
};

export const CARDS = ['amazon', 'paypal', 'starbucks', 'walmart', 'doordash', 'visa', 'netflix', 'cashapp', 'venmo'];
