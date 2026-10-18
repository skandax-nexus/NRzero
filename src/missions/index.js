import m1 from './m1_last_normal_day.js';
import m2 from './m2_helix_goes_dark.js';
import m3 from './m3_first_switch.js';
import m4 from './m4_man_from_last_day.js';

export const MISSIONS = [m1, m2, m3, m4];

// The rest of the campaign from the gameplay bible, shown as the road ahead.
export const ROADMAP = [
  { n: 5, act: 'ACT I', title: 'The Village That Never Existed', text: 'Three states of one village. Divert a river, reinforce a wall, release a gate.' },
  { n: 6, act: 'ACT I', title: 'The Clockmaker\'s House', text: '"When the child returns, do not let him see the ninth minute."' },
  { n: 7, act: 'ACT I', title: 'The Broken Observatory', text: 'They didn\'t know when. They knew who.' },
  { n: 8, act: 'ACT I', title: 'The First Death', text: 'Current timeline: VERSION 17.' },
  { n: '9–13', act: 'ACT II', title: 'The Nine-Minute War', text: 'A looping city, the Continuum, Echo Step, the inverted hospital, the man behind the glass.' },
  { n: '14–18', act: 'ACT III', title: 'The Last Version of Earth', text: '2196. Sera Voss. A memorial with your name on it. The Fracture.' },
  { n: '19–22', act: 'ACT IV', title: 'The Unwritten Second', text: 'Mira\'s memory. The last battle of the Continuum. The first second.' },
  { n: 23, act: 'FINALE', title: 'Afterzero', text: 'Choose what to preserve, and what to release.' },
];
