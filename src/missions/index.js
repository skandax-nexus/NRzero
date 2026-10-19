import m1 from './m1_last_normal_day.js';
import m2 from './m2_helix_goes_dark.js';
import m3 from './m3_first_switch.js';
import m4 from './m4_man_from_last_day.js';

export const MISSIONS = [m1, m2, m3, m4];

// The rest of the campaign from the gameplay bible, one entry per mission.
export const ROADMAP = [
  { n: 5, act: 'ACT I · THE WORLD THAT REMEMBERS', title: 'The Village That Never Existed', text: 'Three states of one village. Divert a river, reinforce a wall, release a gate.' },
  { n: 6, act: 'ACT I · THE WORLD THAT REMEMBERS', title: 'The Clockmaker\'s House', text: 'A workshop that repeats itself. "Do not let him see the ninth minute."' },
  { n: 7, act: 'ACT I · THE WORLD THAT REMEMBERS', title: 'The Broken Observatory', text: 'Align the instruments. They didn\'t know when. They knew who.' },
  { n: 8, act: 'ACT I · THE WORLD THAT REMEMBERS', title: 'The First Death', text: 'Back in a changed present. Current timeline: VERSION 17.' },
  { n: 9, act: 'ACT II · THE NINE-MINUTE WAR', title: 'Nine Minutes to Zero', text: 'A city that repeats the same nine minutes.' },
  { n: 10, act: 'ACT II · THE NINE-MINUTE WAR', title: 'Enemies Who Remember', text: 'Captured by the Continuum. Sera helps you escape. Echo Step.' },
  { n: 11, act: 'ACT II · THE NINE-MINUTE WAR', title: 'The Inverted Hospital', text: 'Some rooms run forward. Others run backward.' },
  { n: 12, act: 'ACT II · THE NINE-MINUTE WAR', title: 'The Man Behind the Glass', text: 'Chase the Witness through three states of Helix.' },
  { n: 13, act: 'ACT II · THE NINE-MINUTE WAR', title: 'The Nine-Minute War', text: 'Two factions, one stabilizer, a district\'s fate.' },
  { n: 14, act: 'ACT III · THE LAST VERSION OF EARTH', title: 'Welcome to 2196', text: 'A beautiful, devastated world that teaches your name.' },
  { n: 15, act: 'ACT III · THE LAST VERSION OF EARTH', title: 'The City That Forgot Tomorrow', text: 'Residents who cannot remember past today.' },
  { n: 16, act: 'ACT III · THE LAST VERSION OF EARTH', title: 'The Museum of Failed Worlds', text: 'Objects from worlds that no longer exist.' },
  { n: 17, act: 'ACT III · THE LAST VERSION OF EARTH', title: 'The Witness\'s Archive', text: 'Every version of Kai\'s life, recorded.' },
  { n: 18, act: 'ACT III · THE LAST VERSION OF EARTH', title: 'The Fracture', text: 'Temporal storms across a collapsing planet.' },
  { n: 19, act: 'ACT IV · THE UNWRITTEN SECOND', title: 'The Place Outside Time', text: 'Roads loop. Rooms connect impossibly.' },
  { n: 20, act: 'ACT IV · THE UNWRITTEN SECOND', title: 'Mira\'s Memory', text: 'Memories that contradict one another.' },
  { n: 21, act: 'ACT IV · THE UNWRITTEN SECOND', title: 'The Last Battle of the Continuum', text: 'Every faction converges. Confront the Witness.' },
  { n: 22, act: 'ACT IV · THE UNWRITTEN SECOND', title: 'The First Second', text: 'Return to the original activation point.' },
  { n: 23, act: 'FINALE', title: 'Afterzero', text: 'Choose what to preserve, and what to release.' },
];
