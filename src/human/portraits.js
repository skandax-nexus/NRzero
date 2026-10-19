// Pose fits of the owner's character art (assets/cast) to the head landmark template.
// u = s*x + tu, v = -s*y + tv in crop pixels after rotating head-space points by (yaw, pitch, roll).
// skin / hair: colours sampled from the de-lit art.
export const PORTRAITS = {
 "kai": {
  "yaw": 0.71558,
  "pitch": 0.0,
  "roll": -0.13963,
  "s": 492.4101,
  "tu": 105.89209,
  "tv": 102.49269,
  "w": 198,
  "h": 154,
  "rms_px": 3.24022,
  "tex": "assets/cast/kai_face.jpg",
  "skin": 10575438,
  "hair": 527642
 },
 "mira": {
  "yaw": 0.06981,
  "pitch": 0.10472,
  "roll": -0.03491,
  "s": 414.13604,
  "tu": 106.31897,
  "tv": 89.28407,
  "w": 198,
  "h": 154,
  "rms_px": 0.79642,
  "tex": "assets/cast/mira_face.jpg",
  "skin": 11103585,
  "hair": 394773
 },
 "witness": {
  "yaw": 0.45379,
  "pitch": 0.06981,
  "roll": -0.13963,
  "s": 499.26468,
  "tu": 97.05515,
  "tv": 83.5625,
  "w": 198,
  "h": 96,
  "rms_px": 3.13071,
  "tex": "assets/cast/witness_face.jpg",
  "skin": 8341825,
  "hair": 4938597
 },
 "sera": {
  "yaw": 0.10472,
  "pitch": 0.06981,
  "roll": -0.03491,
  "s": 396.65839,
  "tu": 96.44922,
  "tv": 82.57025,
  "w": 196,
  "h": 96,
  "rms_px": 1.0376,
  "tex": "assets/cast/sera_face.jpg",
  "skin": 9658190,
  "hair": 4407359
 }
};
