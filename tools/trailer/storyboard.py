#!/usr/bin/env python3
"""AFTERZERO trailer storyboard: the single source of tools/trailer/trailer.json and tools/trailer/shots/g1..g6.json.

    python3 tools/trailer/storyboard.py            # writes the JSON files and prints the beat map
    python3 tools/trailer/storyboard.py --check    # validates only (voice keys, timeline, groups), writes nothing

Edit the EDL (edit decision list) and SHOTS below, never the generated JSON by hand. docs/TRAILER.md explains the
contract (the "shot spec"), the beat map and every shot. Times in camera keys and actions are seconds from the first
recorded frame of the shot (the head handle starts at t = 0; the cut-in point is t = HANDLES / FPS = 0.5 s).
"""
import json, os, sys, math

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'tools', 'trailer')
FPS, HANDLES = 24, 12
H0 = HANDLES / FPS                        # 0.5 s: the cut-in point inside a recording

def url(m, extra=''):
    """?m= is the 0-based mission index (?m=0 is mission 1)."""
    return f'index.html?m={m - 1}&dtcap=0.25&gfx=high&auto' + extra

READY = 'window.__game && __game.control'
# The Zero Second hook (missions 1): reach the frozen platform as tools/tests/m1.json does
M1_GATE = [{'eval': '__game.player.place(0, 0.15, -79, Math.PI)'},
           {'until': "__game.interactables.some(i => i.prompt.includes('badge'))", 'timeout': 30},
           {'eval': "__game.use('badge')"}, {'until': '__game.flags.gate', 'timeout': 40},
           {'eval': '__game.player.place(2, 0.15, -98, Math.PI)'}, {'wait': 1.0}]
M1_FREEZE = M1_GATE + [{'eval': '__game.player.place(3, 0.15, -106, Math.PI)'}, {'until': '__game.flags.frozen', 'timeout': 30}]
WRIST = "DIR.actor('kai').arms[1].hand.getWorldPosition(__game.engine.camera.position.clone())"
KAI = "DIR.actor('kai').root.position"
# the m1 shop windows are a canvas of bright product squares that reads as noise at 1080p: dim them for the trailer
DIM_SHOPS = {'eval': "(()=>{let n=0; __game.scene.traverse(o=>{const m=o.material, p=o.geometry&&o.geometry.parameters; if(o.isMesh&&m&&m.emissiveMap&&p&&p.height===3.2){m.emissiveIntensity=0.45; n++;}}); return n})()"}

SHOTS = {}

def shot(sid, group, mission, beat, camera, setup=(), actions=(), grade='neutral', ready=READY, u=None, chars='',
         look='', notes='', sound=''):
    SHOTS[sid] = dict(id=sid, group=group, mission=mission, beat=beat, url=u or url(mission), ready=ready,
                      setup=list(setup), camera=camera, actions=list(actions), grade=grade, characters=chars,
                      lighting=look, sound=sound, notes=notes)

def path(keys, ease='inOut', shake=0, **kw):
    # focus defaults to the look point's distance (the subject sits on the look point); give k[5] to override
    d = lambda k: round(math.dist(k[1], k[2]), 2)
    c = dict(mode='path', keys=[dict(t=k[0], p=k[1], l=k[2], fov=k[3], roll=(k[4] if len(k) > 4 else 0),
                                     focus=(k[5] if len(k) > 5 and k[5] is not None else d(k))) for k in keys], ease=ease, shake=shake)
    c.update(kw); return c

# ------------------------------------------------------------------------------------------------------------------
# g1 · Rain City, Sunday 19.10.2049, 08:0x (mission 1 street) + the Helix lobby (mission 2)
# ------------------------------------------------------------------------------------------------------------------
shot('s01', 'g1', 1, 'Rain City at night: a slow crane down through the rain onto Kai walking the wet centre line toward Helix.',
     path([[0, [2.4, 9.0, 23.5], [0, 5.0, -40], 46], [3.5, [1.9, 4.0, 13.0], [0.3, 2.4, -30], 44],
           [7.0, [1.2, 1.8, -1.6], [0.4, 1.45, -20], 42]]),
     setup=[DIM_SHOPS, {'eval': '__game.player.place(0.5, 0.15, 15.5, Math.PI)'}, {'wait': 0.5}],
     actions=[{'t': 0.2, 'down': 'KeyW'}],
     grade='rain2049', chars='Kai (walking away from camera), umbrella crowd on both pavements',
     look='Neon blade signs, puddle glow, rain streaks lit by the lamps; Helix tower rings at the vanishing point.',
     sound='Rain bed, distant traffic hum, footsteps; piano motif enters at the cut.')
shot('s02', 'g1', 1, 'The toy that un-falls: a child drops a toy, it lands, then rises back into her hand along the same arc.',
     path([[0, [-7.3, 0.8, -11.9], [-8.8, 0.62, -14.2], 31], [5.5, [-7.45, 0.76, -12.3], [-8.8, 0.6, -14.2], 29]]),
     setup=[DIM_SHOPS, {'eval': '__game.player.place(-4.2, 0.15, -8.5, Math.PI * 0.8)'},
            {'until': '(__game.time % 4) > 3.45 && (__game.time % 4) < 3.55', 'timeout': 8, 'pace': 0}],
     actions=[{'t': 3.6, 'eval': "DIR.actor('child').talk = 1.4"}],
     grade='rain2049', chars='The station child (yellow coat, red boots), her mother under a red umbrella',
     look='Low, child eye-level, in profile along the pavement: lamps and umbrellas recede behind her; the toy\'s cyan eye and its reverse trail.',
     notes='The toy loop runs on game time (4 s): the setup waits for cycle 3.5 so the cut holds hand, fall, floor, un-fall, hand. VO "Mister, your wrist is glowing." lands on the un-fall.')
shot('s03', 'g1', 1, 'Kai\'s wrist: the Chronolith band glows, then flares as the street pulls toward one moment.',
     path([[0, [-0.52, 0.12, -0.55], [0, 0, 0], 30], [3.5, [-0.42, 0.07, -0.46], [0, 0.01, 0], 28]],
          anchor=WRIST, anchorLive=True),
     setup=[DIM_SHOPS, {'eval': '__game.player.place(-1.0, 0.15, -20, Math.PI)'}, {'wait': 1.0}],
     actions=[{'t': 1.7, 'eval': "DIR.actor('kai').wristBoost = 9"}],
     grade='rain2049', chars='Kai (hand and band only, idle)',
     look='Macro close-up, DOF on the band; out-of-focus neon and rain behind.',
     sound='Soft Chronolith glass chime on the flare.')
shot('s04', 'g1', 1, 'The street clock outside Chrono Repair runs backward, one second per second.',
     path([[0, [3.8, 1.75, -29.4], [9.6, 3.45, -34.2], 30], [4.0, [4.35, 1.8, -30.2], [9.6, 3.5, -34.2], 27]]),
     setup=[DIM_SHOPS, {'wait': 0.5}],
     grade='rain2049', chars='none (passers-by in the background)',
     look='Across the street through the rain: the clock face lit warm over Chrono Repair, hands visibly turning back, passers-by under umbrellas crossing frame.',
     sound='Clock ticks reversed (pre-echo ticks).')
shot('s09', 'g1', 2, 'Helix lobby in lockdown red: Dr. Elias Rook, the director, holds Kai\'s gaze.',
     path([[0, [1.28, 1.66, -8.75], [0.48, 1.6, -11.0], 34, 0, None], [3.5, [1.18, 1.67, -9.05], [0.48, 1.6, -11.0], 32]]),
     setup=[{'wait': 5.0}, {'eval': "(()=>{const g=__game, r=g.actors.rook; g.control=false; r.root.visible=true; r.root.position.set(0.5,0,-11); r.root.rotation.y=0.15; r.speed=0; g.player.place(-0.35,0,-8.4,Math.PI*1.05); r.lookTarget=g.player.char.head; g.player.char.lookTarget=r.head; return 'rook'})()"},
            {'wait': 1.5}],
     actions=[{'t': 1.1, 'eval': "DIR.actor('rook').talk = 1.4"}],
     grade='rain2049', u=url(2), ready='window.__game && __game.control && __game.actors.iven',
     chars='Rook (close-up), Kai (soft foreground shoulder)', look='Emergency lighting after the lockdown: red key, cyan rim.',
     notes='Rook walks out of the lobby when control returns (4 s); the setup waits for that, brings him back and holds the drones off (control=false).')

# ------------------------------------------------------------------------------------------------------------------
# g2 · The Zero Second at Central Station (mission 1) + the clockmaker's door (mission 6)
# ------------------------------------------------------------------------------------------------------------------
shot('s05', 'g2', 1, 'Central Station platform: people waiting in the rain; a train\'s light swells up the track.',
     path([[0, [6.0, 1.5, -114.0], [13.2, 2.0, -88], 40], [3.25, [6.3, 1.5, -113.0], [13.2, 2.0, -88], 39]]),
     setup=M1_GATE,
     actions=[{'t': 0.3, 'eval': '__game.player.place(3, 0.15, -106, Math.PI)'}],
     grade='rain2049', chars='Jun Park (transit operator), three civilians on the platform, Kai (foreground left)',
     look='Warm platform canopy light, the yellow edge strip, the stopped station clock.',
     sound='Train horn (the game\'s 311 / 370 Hz pair), rising rail hiss.',
     notes='The mission freezes ~2.2 s after Kai crosses z -104 (action at t 0.3): cut out on the frame before the freeze.')
shot('s06', 'g2', 1, 'The Zero Second: the derailing train hangs in the air, sparks and rain frozen around it.',
     path([[0, [10.0, 1.3, -100.5], [12.6, 1.4, -90], 40], [5.0, [10.2, 1.4, -99.0], [12.6, 1.5, -89], 38]], ease='linear'),
     setup=M1_FREEZE + [{'wait': 0.3}],
     grade='rain2049', chars='Frozen civilians, Jun',
     look='The freeze grade (desaturated, cold); sparks as hanging points of light; rain as beads.',
     sound='Hard cut into one second of total silence (bible: the Zero Second), then a low metallic resonance.')
shot('s07', 'g2', 1, 'Kai walks alone through the frozen station: the only thing still moving.',
     path([[0, [-1.93, 1.5, -1.87], [0.41, 1.3, -0.69], 40], [5.0, [-2.05, 1.55, -1.70], [0.41, 1.3, -0.69], 40]],
          ease='linear', anchor=KAI, anchorLive=True),
     setup=M1_FREEZE + [{'until': '__game.flags.frozen && __game.control', 'timeout': 40},
                        {'eval': '__game.player.place(-1.5, 0.15, -100.5, 2.6)'}, {'wait': 0.3}],
     actions=[{'t': 0.0, 'down': 'KeyW'}],
     grade='rain2049', chars='Kai (tracking side-on), frozen commuters and umbrellas between camera and Kai',
     look='Frozen rain beads catch the station light; Kai the only warm, moving figure.',
     sound='Kai\'s footsteps, glass-harmonic shimmer of the held rain.')
shot('s08', 'g2', 1, 'In the crowd, a woman with Mira\'s face looks at Kai, then comes apart like light.',
     path([[0, [-2.75, 1.63, -121.9], [-3.5, 1.58, -125.0], 30, 0, 3.2], [5.5, [-2.86, 1.62, -122.45], [-3.5, 1.58, -125.0], 28, 0, 2.65]]),
     setup=M1_FREEZE + [{'until': '__game.flags.frozen && __game.control', 'timeout': 40},
                        {'eval': "[0,1,2].forEach(()=>{const it=__game.interactables.find(i=>i.prompt.includes('safety')); if(it) __game.useInteract(it);})"},
                        {'until': '__game.actors.mira && __game.actors.mira.root.visible', 'timeout': 60}],
     grade='rain2049', chars='Mira (close-up, looking at Kai), crowd behind',
     look='Helix entrance glow behind her; her violet dissolve (the mission\'s ghost shader).',
     sound='The three-note motif (E-B-A) on felt piano; Kai: "...Mira?"',
     notes='The mission fades her out (alpha 0.7 / s) right after Kai\'s line: about 1.6 s solid, 1.4 s dissolve.')
shot('s16', 'g2', 6, 'The clockmaker opens his door before Kai knocks: "You\'re late."',
     path([[0, [0.95, 1.72, 9.75], [0.1, 1.62, 7.95], 34], [4.0, [0.85, 1.72, 9.55], [0.1, 1.62, 7.95], 32]]),
     setup=[{'until': "__game.control && __game.interactables.some(i=>i.prompt.includes('Knock'))", 'timeout': 600},
            {'eval': "__game.player.place(0, 0, 9.8, Math.PI); __game.use('Knock')"},
            {'until': "__game.actors.oskar && __game.actors.oskar.root.visible && __game.actors.oskar.root.position.z > 7.85", 'timeout': 30}],
     grade='rain2049', u=url(6), ready=READY,
     chars='Oskar Hensel (78, clockmaker) in his doorway, Kai (foreground shoulder)',
     look='Rain on the old quarter, warm shop light from inside the door.',
     notes='The mission stages this scene itself after the knock; the path holds its close shot a little longer.')


# ------------------------------------------------------------------------------------------------------------------
# g3 · The Chronolith chamber in three states (mission 3) + Harrow Reach (mission 15)
# ------------------------------------------------------------------------------------------------------------------
M3_READY = "window.__game && __game.control && __game.interactables.some(i=>i.prompt.includes('Touch'))"
M3_EXPOSE = {'eval': '__game.engine.renderer.toneMappingExposure = 0.82'}   # the clean 2049 lab reads milky at the mission's 1.1
RING_POWER = "(v => { const c = __game.scene.children.find(o => o.userData && o.userData.disc); if (c) c.userData.disc.material.uniforms.uPower.value = v; return !!c; })"
shot('s10', 'g3', 3, 'The Chronolith: a black ring older than the building, turning in its sealed chamber.',
     path([[0, [0.7, 1.35, 11.4], [0, 3.5, -2], 46], [4.1, [0.35, 2.1, 8.4], [0, 3.6, -2], 43]]),
     setup=[M3_EXPOSE, {'eval': '__game.player.place(-1.1, 0, 5.4, Math.PI)'}, {'wait': 1.0}],
     grade='rain2049', u=url(3), ready=M3_READY,
     chars='Kai (small, foreground left, looking up at the ring); Iven by the consoles',
     look='The ring\'s cyan core light; the chamber in shadow, its rim light strip on the floor.',
     sound='Low hum at the ring\'s frequency (41 Hz bed), one glass partial.')
shot('s11', 'g3', 3, 'The first switch: Kai reaches for the ring and the room flickers through 2026, 2196 and back to 2049.',
     path([[0, [4.6, 1.5, 4.6], [-0.6, 2.5, -2.2], 40], [5.6, [3.9, 1.55, 3.8], [-0.6, 2.5, -2.2], 38]], shake=0.15),
     setup=[M3_EXPOSE, {'eval': '__game.player.place(0, 0, 0.95, Math.PI)'}, {'wait': 0.8}],
     actions=[{'t': 0.8, 'eval': RING_POWER + '(0.6)'}, {'t': 0.8, 'eval': "DIR.actor('kai').pose = 'work'; DIR.actor('kai').wristBoost = 12"},
              {'t': 1.5, 'eval': "DIR.era('2026', 0.45)"}, {'t': 1.55, 'eval': "__game.engine.setGrade('helix2026')"},
              {'t': 2.35, 'eval': "DIR.era('2196', 0.45)"}, {'t': 2.4, 'eval': "__game.engine.setGrade('ruin2196')"},
              {'t': 3.15, 'eval': "DIR.era('2026', 0.4)"}, {'t': 3.2, 'eval': "__game.engine.setGrade('helix2026')"},
              {'t': 3.95, 'eval': "DIR.era('2049', 0.5)"}, {'t': 4.0, 'eval': "__game.engine.setGrade('rain2049')"}],
     grade='rain2049', u=url(3), ready=M3_READY,
     chars='Kai (three-quarter back, hand toward the ring)',
     look='2026: amber work lights, scaffolds, plastic sheets; 2049: clean cyan lab; 2196: green-grey ruin. Same ring in all three.',
     sound='The temporal switch (the game\'s switch stinger) on each flicker, pitched up each time.',
     notes='DIR.era drives the switch on game time (temporal.switchTo runs on wall time and would be skipped by a frame-stepped capture).')
shot('s33', 'g3', 3, 'Montage: Kai\'s face in the ring light as the room tears between eras.',
     path([[0, [0.38, 1.5, -0.6], [0, 1.45, 0.95], 40], [2.1, [0.42, 1.5, -0.45], [0, 1.45, 0.95], 39]], shake=0.35),
     setup=[M3_EXPOSE, {'eval': '__game.player.place(0, 0, 0.95, Math.PI)'}, {'eval': RING_POWER + '(0.9)'}, {'wait': 0.8}],
     actions=[{'t': 0.55, 'eval': "DIR.era('2196', 0.3)"}, {'t': 1.05, 'eval': "DIR.era('2026', 0.3)"}, {'t': 1.5, 'eval': "DIR.era('2049', 0.3)"}],
     grade='rain2049', u=url(3), ready=M3_READY, chars='Kai (medium shot, facing camera, the ring behind camera)',
     look='Hard cyan key from the ring core, era colour washing over his face on each switch.')
shot('s35', 'g3', 3, 'Final image: Kai alone before the Chronolith, small against the ring.',
     path([[0, [0, 1.6, 11.6], [0, 3.0, -2], 40], [5.0, [0, 1.66, 10.4], [0, 3.05, -2], 38]], ease='sine'),
     setup=[M3_EXPOSE, {'eval': '__game.player.place(0, 0, 4.6, Math.PI); __game.actors.iven.root.visible = false'}, {'eval': RING_POWER + '(0.75)'}, {'wait': 1.0}],
     grade='rain2049', u=url(3), ready=M3_READY, chars='Kai (silhouette, back to camera, centred)',
     look='Symmetric, the ring core the only bright thing; slow push-in.', sound='Piano motif returns, alone.')
shot('s36', 'g3', 3, 'Button: Kai lifts his hand to the ring. Iven: "Don\'t touch it. Varen. Don\'t—" Cut on the switch.',
     path([[0, [4.7, 1.72, 5.3], [0, 1.9, 0.2], 34, 0, 6.4], [3.5, [4.45, 1.72, 5.0], [0, 1.95, 0.0], 32, 0, 6.1]]),
     setup=[M3_EXPOSE, {'eval': '__game.player.place(0, 0, 1.0, Math.PI)'},
            {'eval': "(()=>{const i=__game.actors.iven; i.root.position.set(2.9,0,4.6); i.lookTarget=__game.player.char.head; return 'iven'})()"},
            {'wait': 0.8}],
     actions=[{'t': 0.8, 'eval': "DIR.actor('iven').talk = 2.2"}, {'t': 1.6, 'eval': "DIR.actor('kai').pose = 'work'"},
              {'t': 2.3, 'eval': RING_POWER + '(0.95)'}, {'t': 2.3, 'eval': "DIR.actor('kai').wristBoost = 14"},
              {'t': 2.55, 'eval': "DIR.era('2196', 0.9)"}],
     grade='rain2049', u=url(3), ready=M3_READY,
     chars='Iven Marr (soft foreground shoulder, right), Kai at the ring', look='Over Iven\'s shoulder; ring flare at the end.',
     notes='The edit cuts to black on the first frame of the switch distortion (about t 2.6).')
shot('s26', 'g3', 15, 'Montage: Harrow Reach, the city that relives one day, under the Lantern\'s beam.',
     path([[0, [30, 7, 22], [0, 12, -24], 48], [2.1, [28.6, 6.8, 20.6], [0, 12, -24], 48]], ease='linear'),
     setup=[{'wait': 0.5}], grade='ruin2196', u=url(15), chars='none (crowds too small to read)',
     look='The plaza and the Hollow Archive\'s copper dome in the amber haze of the lock.')

# ------------------------------------------------------------------------------------------------------------------
# g4 · The ancient valley, the drowned village and the Sky House (missions 4, 5, 7)
# ------------------------------------------------------------------------------------------------------------------
M4_READY = 'window.__game && __game.control && __game.actors.niko'
shot('s12', 'g4', 4, 'The ancient settlement at golden hour: a valley built around a ring of stone.',
     path([[0, [5.8, 1.8, 26.5], [0, 2.4, -10], 44], [4.1, [3.0, 6.2, 25.0], [0, 3.0, -12], 48]]),
     setup=[{'eval': '__game.player.place(0, 0, 21.5, Math.PI)'}, {'wait': 0.6}],
     actions=[{'t': 0.3, 'down': 'KeyW'}],
     grade='ancient', u=url(4), ready=M4_READY, chars='Kai walking in, Tala and villagers',
     look='Low warm sun, long shadows, dust motes; the stone ring at the heart of the village.',
     sound='Wind and water bed; the switch transition lands on the cut.')
shot('s13', 'g4', 4, 'Niko, keeper of the Telling, reads the ring on Kai\'s wrist: "You came before the first fire."',
     path([[0, [1.8, 2.0, -3.4], [2.5, 2.08, -6.2], 32], [4.1, [1.9, 1.99, -3.8], [2.5, 2.08, -6.2], 30]]),
     setup=[{'eval': "(()=>{const g=__game, n=g.actors.niko; g.player.place(1.14, 0.6, -4.1, 2.57); n.root.rotation.y=-0.373; n.lookTarget=g.player.char.head; g.player.char.lookTarget=n.head; return 'niko'})()"},
            {'wait': 1.0}],
     actions=[{'t': 0.9, 'eval': "DIR.actor('niko').talk = 1.5"}],
     grade='ancient', u=url(4), ready=M4_READY, chars='Niko (close-up), Kai (soft foreground shoulder)',
     look='Warm key from the low sun, cool sky fill; shallow focus.')
shot('s14', 'g4', 5, 'One valley, two ages: the thriving village switches to Helix\'s drowned Reservoir 7.',
     path([[0, [4.6, 9.0, 14.6], [-6, 1, -6], 50], [5.6, [3.2, 8.6, 13.3], [-6, 1, -6], 49]]),
     setup=[{'wait': 0.8}],
     actions=[{'t': 2.6, 'eval': "DIR.era('flooded', 1.0)"}, {'t': 3.0, 'eval': "__game.engine.setGrade('neutral')"}],
     grade='ancient', u=url(5), chars='Villagers in the lanes (thriving); dead trees standing in the water (flooded)',
     look='Golden hour to overcast 2049 daylight; water level rises over the same houses.',
     sound='Switch stinger, then the causal-consequence resonance under the dam hum.')
shot('s31', 'g4', 5, 'Montage: Reservoir 7, dead trees standing in the water over a village that never existed.',
     path([[0, [-17, 10, -4], [16, 1, 40], 52], [2.1, [-15.8, 9.7, -3.0], [16, 1, 40], 52]], ease='linear'),
     setup=[{'eval': "__game.temporal.setImmediate('flooded')"}, {'wait': 0.8}],
     grade='neutral', u=url(5), chars='none', look='Flat overcast light on the water, the dam across the valley.')
M7_READY = READY
shot('s15', 'g4', 7, 'The Sky House: the observatory at dawn c. 1000 BCE switches to Helix\'s floodlit 2049 night.',
     path([[0, [-9, 26, -2], [12, 4, 30], 48], [4.1, [-6.5, 24.5, 0.5], [12, 4.5, 30], 47]]),
     setup=[{'wait': 0.8}],
     actions=[{'t': 2.2, 'eval': "DIR.era('2049', 1.0)"}, {'t': 2.6, 'eval': "__game.engine.setGrade('rain2049')"}],
     grade='ancient', u=url(7), ready=M7_READY, chars='Keepers and acolytes on the court (too small to read)',
     look='Over the drum toward the sunrise, then the same view at night: a starfield over Helix floodlights and scaffolds.',
     sound='Night: glass tones under Mira\'s recorded voice.')
shot('s25', 'g4', 7, 'Montage: dusk on the ruined summit, 2196; the scavenger chief Dace on the pillar, gauntlet glowing.',
     path([[0, [7.0, 23.4, -15.0], [-10, 22.2, -16.5], 44], [2.1, [6.6, 23.3, -15.6], [-10, 22.2, -16.5], 43]], ease='linear'),
     setup=[{'eval': "__game.temporal.setImmediate('2196'); __game.player.place(-7.9, 21.06, -21.6, Math.PI / 2)"}, {'wait': 0.8}],
     grade='ruin2196', u=url(7), ready=M7_READY, chars='Dace (scavenger boss), scavenger lookouts',
     look='Sunset behind the broken rim, Venus low in the west, green gauntlet glow.')

# ------------------------------------------------------------------------------------------------------------------
# g5 · 2196 and the Fracture (missions 14, 18), Helix containment (8), the inverted hospital (11)
# ------------------------------------------------------------------------------------------------------------------
shot('s17', 'g5', 14, 'Welcome to 2196: Rain City a hundred and forty-seven years on, overgrown, silent, beautiful.',
     path([[0, [5, 54, 168], [0, 14, 70], 50], [5.6, [6, 41, 151], [-1, 12, 74], 49]]),
     setup=[{'wait': 0.8}], grade='ruin2196', u=url(14), chars='Kai (tiny, at the landing)',
     look='Morning haze, trees on the roofs, the broken tram viaduct; birds.',
     sound='2196 bed: processed wind, birds, a far bell. Sera\'s line over it.')
shot('s18', 'g5', 14, 'The memorial square: a bronze statue of Kai before a ring, "ARCHITECT OF THE FRACTURE".',
     path([[0, [-3.2, 0.75, -42.0], [-8, 5.4, -55], 40], [4.1, [-4.4, 0.9, -44.2], [-8, 5.6, -55], 38]]),
     setup=[{'eval': '__game.player.place(-6.0, 0, -46.8, -2.903)'}, {'wait': 0.8}],
     grade='ruin2196', u=url(14), chars='Kai (back to camera, small, looking up at his own statue)',
     look='Low angle, the statue against the bright sky; candles and stones at the plinth.')
shot('s30', 'g5', 18, 'Montage: the Corran Building, its upper floors torn away by the storm.',
     path([[0, [8, 1.6, 34], [0, 20, -2], 54], [2.1, [7.2, 2.0, 31.5], [0, 20, -2], 54]], ease='linear'),
     setup=[{'wait': 0.8}], grade='ruin2196', u=url(18, '&m18part=4'), chars='none', look='Looking up the broken tower into storm light.',
     notes='?m18part=4 is mission 18\'s own chapter start (development switch); nothing from later missions is loaded.')
shot('s28', 'g5', 18, 'Montage: the Eastway at night, the sea of 2196 poured into 2049\'s highway.',
     path([[0, [8, 6, 40], [-2, 0, -20], 50], [2.1, [7.2, 5.6, 36.5], [-2, 0, -20], 50]], ease='linear'),
     setup=[{'wait': 0.8}], grade='rain2049', u=url(18, '&m18part=3'), ready='window.__game && __game.control && window.__m18 && __m18.ch3',
     chars='none (the stalled N4 bus far down the road)', look='Night rain on flood water, wrecked traffic, highway lights.')
shot('s32', 'g5', 18, 'Montage: the storm front bearing down on Lantern Hall as its anchor fails.',
     path([[0, [10, 16, -62], [-2, 6, -118], 50], [2.1, [9.0, 15.2, -64.5], [-2, 6, -118], 50]], ease='linear'),
     setup=[{'wait': 0.8}], grade='ruin2196', u=url(18, '&m18part=1'), chars='Survivors in the hall (small)',
     look='Violet storm light over the iron trusses.')
shot('s27', 'g5', 8, 'Montage: Dr. Yara Lind, stopped mid-stride inside the containment field for three days.',
     path([[0, [1.8, 1.5, -63.0], [-0.6, 1.25, -66.6], 40], [2.1, [1.45, 1.5, -63.5], [-0.6, 1.25, -66.6], 39]], ease='linear'),
     setup=[{'wait': 0.8}], grade='rain2049', u=url(8), chars='Yara (frozen)', look='Containment rings, cold field light.')
shot('s22', 'g5', 11, 'Montage: Halden General\'s reversed East Corridor: a gurney, a cylinder and glass fly back to where they were at 08:14.',
     path([[0, [16.4, 2.4, 2.2], [24, 0.8, 4.6], 48], [3.05, [17.3, 2.2, 2.6], [24, 0.9, 4.6], 46]], ease='linear'),
     setup=[{'eval': '__game.player.place(14.6, 0, 3.2, Math.PI / 2)'}, {'wait': 1.5}],
     grade='rain2049', u=url(11), chars='Kai at the threshold (edge of frame)',
     look='Hospital corridor in night emergency light; the reversal chevrons on the floor; debris travelling backward.',
     notes='The corridor\'s hazards cycle (land, return, hold) on their own schedule; check the strip that one is in flight.')

# ------------------------------------------------------------------------------------------------------------------
# g6 · The Nine-Minute War (missions 9, 10, 12, 13)
# ------------------------------------------------------------------------------------------------------------------
LOOP = "import('/src/systems/loops.js').then(m => { const L = m.loopState.active; L.skipTo(%s); return L.t; })"
shot('s20', 'g6', 9, 'Montage: Meridian Square at 08:14:00 — the whole district stops, then rewinds to 08:05.',
     path([[0, [-22, 6.0, -24.0], [0, 1.2, -32], 42], [5.1, [-21.2, 5.8, -24.6], [0, 1.2, -32], 40]], ease='linear'),
     setup=[{'eval': '__game.player.place(-31, 7.2, -24, Math.PI / 2)'}, {'wait': 0.5}, {'eval': LOOP % '535.4'}],
     grade='rain2049', u=url(9), chars='Continuum troopers in white armour, commuters, the tram',
     look='Morning light on the square; the freeze desaturates it as the reset arrives.',
     notes='The loop fires its reset at loop time 538.6 (DUR - 1.4): about 3.2 s after the skip. The reset waits while game.cine is set, so this shot must not hold the camera through game.cine (the default).')
shot('s29', 'g6', 10, 'Montage: the Continuum spire grafted onto the ruin of Helix, dusk, 2196.',
     path([[0, [150, 22, 50], [70, 30, 0], 44], [2.1, [146, 21, 46.5], [70, 30, 0], 44]], ease='linear'),
     setup=[{'wait': 0.5}], grade='ruin2196', u=url(10), chars='none', look='Dusk, the pearl spire lit gold.')
M12_READY = "window.__game && window.__m12 && __game.control && document.getElementById('objective-text').textContent.includes('Rook')"
shot('s19', 'g6', 12, 'The man behind the glass: from behind a grey-haired man in a long coat, Kai beyond the glass. He taps three notes.',
     path([[0, [3.0, 1.55, -12.9], [1.6, 1.6, -7.5], 32, 0, 6.3], [4.9, [2.85, 1.58, -12.55], [1.6, 1.6, -7.5], 30, 0, 6.0]]),
     setup=[{'eval': '__game.player.place(0, 0, -6.4, Math.PI)'},
            {'until': '__game.actors.witness && __game.actors.witness.root.visible', 'timeout': 40},
            {'wait': 3.4}],
     grade='rain2049', u=url(12), ready=M12_READY,
     chars='The Witness (back and shoulder only, never his face), Kai behind the glass (in focus)',
     look='Test Hall C lights up on him; the gallery glass reflects; his coat a dark silhouette.',
     sound='Three notes tapped on the glass (E-B-A), the game\'s glass voice; then silence.',
     notes='Spoiler rule: his face and wrist are never in frame.')
shot('s21', 'g6', 12, 'Montage: Echo Step — Kai leaves an afterimage and slips through the jammed lockdown shutter.',
     path([[0, [10.6, 1.6, -15.6], [10, 1.1, -21.5], 50], [3.05, [10.5, 1.55, -16.2], [10, 1.1, -22.0], 50]], ease='linear'),
     setup=[{'eval': '__game.player.place(0, 0, -6.4, Math.PI)'},
            {'until': "__game.control && document.getElementById('objective-text').textContent.includes('Chase')", 'timeout': 240},
            {'eval': '__game.player.place(10, 0, 0.4, Math.PI)'},
            {'until': '__m12.S.seen && __m12.S.seen.glimpse1 && __game.control', 'timeout': 120},
            {'eval': '__game.player.place(10, 0, -16.2, Math.PI)'},
            {'until': "__game.control && document.getElementById('objective-text').textContent.includes('Echo Step')", 'timeout': 120},
            {'eval': '__game.player.place(10, 0, -19.9, Math.PI); __game.player.yaw = Math.PI'}, {'wait': 0.6}],
     actions=[{'t': 0.7, 'eval': '__m12.echo.trigger()'}],
     grade='rain2049', u=url(12), ready=M12_READY, chars='Kai and his afterimage', look='Lockdown red on the shutter, cyan afterimage.',
     notes='Setup follows tools/tests/m12.json up to the shutter.')
M13_READY = "window.__game && window.__m13 && __game.control && document.getElementById('objective-text').textContent.includes('held district')"
M13_WAR = [{'eval': '__game.player.place(2, 0, 51, Math.PI)'}, {'until': "__game.temporal.current === '2196'", 'timeout': 60}]
shot('s34', 'g6', 13, 'Montage: the Sable Yards held in one second — people mid-step, rain hanging in the air.',
     path([[0, [6, 4.5, 72], [0, 2, 46], 44], [2.1, [5.2, 4.1, 68.5], [0, 2, 46], 44]], ease='linear'),
     setup=[{'wait': 0.5}], grade='rain2049', u=url(13), ready=M13_READY, chars='Held residents, a courier, an umbrella',
     look='Grey dawn, beads of rain frozen in the air.')
shot('s23', 'g6', 13, 'Montage: 2196, the same yards are a battlefield; shells arc out of the stabilizer\'s ring.',
     path([[0, [-3, 8.5, 40], [0, 9, -6], 48], [3.0, [-2.5, 8.0, 36.8], [0, 9, -6], 48]], ease='linear', shake=0.12),
     setup=M13_WAR + [{'wait': 2.0}],
     actions=[{'t': 0.6, 'eval': '__m13.W.tracer([0, 9, -2], [-4, 0.5, 42], 1.6, 7)'}, {'t': 1.3, 'eval': '__m13.W.tracer([0, 9, -2], [3, 0.5, -40], 1.6, 7)'}],
     grade='ruin2196', u=url(13), ready=M13_READY, chars='Unwritten fighters behind the barricade (small)',
     look='Smoke and dust, tracer light from the spire.')
shot('s24', 'g6', 13, 'Sera Voss, who leads the survivors: "The future that survives long enough to remember us."',
     path([[0, [0.75, 1.62, -2.3], [0, 1.58, 0], 30], [3.0, [0.68, 1.62, -2.1], [0, 1.58, 0], 29]], anchor="DIR.actor('sera').root.position", anchorLive=False),
     setup=M13_WAR + [{'until': "__game.control && document.getElementById('objective-text').textContent.includes('Cross the yard')", 'timeout': 200},
                      {'eval': "(()=>{const g=__game, s=g.actors.sera; const q = s.root.position; g.player.place(q.x - 0.4, q.y, q.z - 2.4, 0); s.root.rotation.y = Math.PI; s.speed = 0; s.lookTarget = g.player.char.head; return 'sera'})()"},
                      {'wait': 0.8}],
     actions=[{'t': 0.62, 'eval': "DIR.actor('sera').talk = 2.6"}],
     grade='ruin2196', u=url(13), ready=M13_READY, chars='Sera Voss (close-up), Kai (soft foreground shoulder)',
     look='Firelight from the camp on one side, grey war light on the other.')

# ------------------------------------------------------------------------------------------------------------------
# EDL (edit decision list): the trailer in order. Boundaries are rounded to whole frames.
#   ('shot', id, seconds, transition)  ('card', id, seconds, transition, text, style)
# Transition = how this event begins: cut | dissolve | dip (from black) | switch (the temporal switch distortion).
# ------------------------------------------------------------------------------------------------------------------
B78, B118 = 60 / 78, 60 / 118
EDL = [
    # (a) the quiet hook: Rain City, Sunday 19.10.2049, and the Zero Second
    ('card', 'black0', 1.5, 'cut', '', 'black'),
    ('shot', 's01', 6.0, 'dip'), ('shot', 's02', 4.5, 'cut'), ('shot', 's03', 2.5, 'cut'), ('shot', 's04', 3.0, 'cut'),
    ('shot', 's05', 2.25, 'cut'), ('shot', 's06', 4.0, 'cut'), ('shot', 's07', 4.0, 'cut'), ('shot', 's08', 4.5, 'cut'),
    ('card', 'black1', 2.75, 'cut', '', 'black'),
    # (b) the world opens: 78 BPM, cuts on the beat
    ('shot', 's09', 3 * B78, 'cut'), ('shot', 's10', 4 * B78, 'cut'), ('shot', 's11', 6 * B78, 'cut'),
    ('shot', 's12', 4 * B78, 'switch'), ('shot', 's13', 4 * B78, 'cut'), ('shot', 's14', 6 * B78, 'switch'),
    ('shot', 's15', 4 * B78, 'dissolve'), ('shot', 's16', 3 * B78, 'cut'), ('shot', 's17', 6 * B78, 'switch'),
    ('shot', 's18', 4 * B78, 'cut'), ('shot', 's19', 5 * B78, 'dip'),
    ('card', 'c1', 3 * B78, 'dip', 'SOMEONE HAS BEEN HERE BEFORE YOU', 'line'),
    # (c) the montage: 118 BPM, two bars, then bars, then half bars
    ('shot', 's20', 8 * B118, 'cut'), ('shot', 's21', 4 * B118, 'cut'), ('shot', 's22', 4 * B118, 'cut'),
    ('shot', 's23', 4 * B118, 'cut'), ('shot', 's24', 4 * B118, 'cut'),
    ('shot', 's25', 2 * B118, 'cut'), ('shot', 's26', 2 * B118, 'cut'), ('shot', 's27', 2 * B118, 'cut'),
    ('shot', 's28', 2 * B118, 'cut'), ('shot', 's29', 2 * B118, 'cut'), ('shot', 's30', 2 * B118, 'cut'),
    ('shot', 's31', 2 * B118, 'switch'), ('shot', 's32', 2 * B118, 'cut'), ('shot', 's33', 2 * B118, 'cut'),
    ('shot', 's34', 2 * B118, 'switch'),
    ('card', 'silence', 1.2, 'cut', '', 'black'),
    ('shot', 's35', 4.0, 'cut'),
    ('card', 'tagline', 2.5, 'dip', 'A SECOND THAT SHOULD NOT EXIST', 'line'),
    ('card', 'title', 4.5, 'dip', 'AFTERZERO\nTHE LAST VERSION OF EARTH', 'title'),
    ('shot', 's36', 2.5, 'dip'),
    ('card', 'end', 5.0, 'cut', 'AFTERZERO\nPlay on mobile and web\nAn original game · in-engine footage · original score · voices: Piper TTS, LibriTTS voices (CC BY 4.0)', 'end'),
]

# VO: (trailer time s, speaker, exact line text, mission, clip_in s, clip_out s, notes). The key is FNV-1a("speaker|text")
# base 36 as in src/core/voice.js; it is null in trailer.json when assets/voice has no recording (key_pending holds it).
VO = [
    (10.6, 'child', 'Mister, your wrist is glowing.', 1, None, None, 'on the un-fall; the child\'s mouth moves (talk action)'),
    (24.0, 'kai', '…Nothing is moving. The rain. The train. Me — only me.', 1, None, None, 'quiet, close; the only voice in the held second'),
    (28.95, 'kai', '…Mira?', 1, None, None, 'barely voiced; just before she dissolves'),
    (32.35, 'voice', 'Kai Varen. Do not build the machine.', 1, None, None, 'over black: the station PA voice, wide reverb'),
    (38.55, 'kai', 'The Chronolith.', 2, None, None, ''),
    (41.0, 'kai', 'Which one is real?', 3, None, None, ''),
    (42.45, 'voice', 'All of them. That\'s why this is dangerous.', 3, None, None, 'same PA voice as the hook'),
    (48.5, 'niko', 'The ring on your wrist is the Ring in our valley. You came before the first fire.', 4, 1.78, 3.2, 'use only the tail: "You came before the first fire."'),
    (50.2, 'kai', 'I\'ve never been here.', 4, None, None, ''),
    (51.75, 'niko', 'That is what the others said.', 4, None, None, 'carries over the switch into s14'),
    (56.0, 'mirarec', 'It doesn\'t record you, Kai. It\'s been waiting for you. Every instrument in this house points at one night — the night you were born.', 7, 0.0, 2.95, 'use only: "It doesn\'t record you, Kai. It\'s been waiting for you."'),
    (59.55, 'oskar', 'You\'re late.', 6, None, None, 'Hensel\'s mouth moves (talk action)'),
    (61.8, 'sera', 'In my time, your face is on every memorial.', 10, None, None, 'over 2196 (the line is from mission 10)'),
    (64.5, 'kai', 'For saving the world?', 10, None, None, ''),
    (66.6, 'sera', 'For ending it.', 10, None, None, 'land on the statue reveal'),
    (70.4, 'recording', '…do not let him see the ninth minute.', 6, None, None, 'the older-Kai recording voice, over the man behind the glass'),
    (75.3, 'voice', 'You have nine minutes.', 9, None, None, 'the Meridian PA'),
    (83.3, 'sera', 'This is not the future.', 13, None, None, ''),
    (85.3, 'sera', 'The future that survives long enough to remember us.', 13, None, None, 'on screen (s24, talk action)'),
    (109.9, 'iven', 'Don\'t touch it. Varen. Don\'t—', 3, None, None, 'the button; the cut eats the last syllable'),
]

MUSIC = [
    (0.0, 'rain', None, 'No score. Rain City bed fades up from silence: rain, far traffic, a murmur of the crowd.'),
    (1.5, 'hook · AFTERZERO main theme, intimate', 78, 'Felt piano alone: the three-note motif E-B-A (Kai and Mira\'s shared memory), rubato, lots of air. A low cello pedal joins at 7.5. Breath-like texture, no drums. Minor mode with a suspended chord.'),
    (17.5, 'approach', 78, 'A muted low piano ostinato starts to drift off the grid (Kai\'s "need to fix it" cell); bowed metal swells under the train horn pair (311 / 370 Hz, from the game).'),
    (19.75, 'SILENCE · the Zero Second', None, 'One second of digital silence: rain, crowd and score all stop (bible section 7, silence as storytelling).'),
    (20.75, 'the held second', None, 'Free time: glass harmonics, a sub drone, the causal-consequence resonance; nothing on the beat.'),
    (27.75, 'Mira · memory without a body', 64, 'The motif on felt piano, closer and warmer, one warm cello harmonic; unresolved. A reversed tail, used once.'),
    (32.25, 'the voice', None, 'Everything drops to a low sub and one sustained cello note under the voice.'),
    (35.0, 'world · main theme expands', 78, 'Piano motif plus low strings in octaves; slowly expanding; every cut lands on a beat.'),
    (45.0, 'world · the past', 78, 'Frame drum on beats 1 and 3, breathy flute counter-line, plucked strings and water texture for the valley (no cultural pastiche).'),
    (55.77, 'world · night glass', 78, 'Glass tones and sparse piano for the observatory night and the clockmaker; strings hold.'),
    (61.15, 'world · beautiful catastrophe', 78, 'Wide strings, distant brass, processed wind; sparse piano; no heavy drums (bible 2196 cue).'),
    (68.85, 'the Witness', 54, 'The motif slower and lower in bowed bass and bowed metal, irregular pulse; the three glass taps are its last notes.'),
    (72.69, 'card · breath', None, 'Near silence; one reversed glass swell rises into the montage downbeat.'),
    (75.0, 'montage · the Nine-Minute War', 118, 'Precise layered percussion (frame drum, low toms, ticks), short string ostinati; every 7th bar slips by an eighth; brief gaps and reversed impacts before hits; no trailer booms.'),
    (87.2, 'montage · half-bar cuts', 118, 'All layers; the string ostinato doubles; a reversed impact before every second cut; the last bar thins to ticks alone.'),
    (97.37, 'SILENCE', None, 'Hard stop: 1.2 s of digital silence.'),
    (98.57, 'title · main theme reprise', 78, 'Piano motif alone, then cello; strings bloom under the tagline; the hopeful suspended chord on the title card, its top note left unresolved.'),
    (109.57, 'button', None, 'Only diegetic sound: ring hum, Iven\'s voice, the switch stinger, then silence on the cut.'),
    (112.07, 'end card', None, 'One low piano A ringing out under a rain tail; fade over the last second.'),
]

SFX = [
    (0.0, 'rain bed (Rain City)', 'Fade in over 1.5 s; the game\'s rain + crowd beds.'),
    (9.9, 'toy un-fall: reverse whoosh', 'The toy rises back into her hand (the game\'s rewind voice, soft).'),
    (13.2, 'Chronolith glass chime', 'The band flares on Kai\'s wrist.'),
    (14.5, 'reversed clock ticks', 'Each tick with its pre-echo; one per second.'),
    (17.6, 'train horn', 'The game\'s 311 / 370 Hz sawtooth pair, then rail hiss rising.'),
    (19.75, 'the Zero Second: total silence', '1.0 s, rain included.'),
    (20.75, 'causal-consequence resonance', 'Low metallic resonance followed by a brief dropout (bible section 7).'),
    (24.0, 'Kai\'s footsteps in the held rain', 'The only moving sound; glass-harmonic shimmer from the frozen drops.'),
    (28.6, 'motif sting', 'The game\'s motif stinger as Mira looks at Kai.'),
    (35.0, 'lockdown alarm (muffled)', 'Helix alarm through glass, two pulses.'),
    (40.38, 'temporal switch ×4', 'The switch stinger on each era flicker in s11 (t 41.4, 42.2, 43.0, 43.8).'),
    (45.0, 'temporal switch (transition)', 'Into the ancient valley; wind and water bed.'),
    (51.15, 'temporal switch + causal resonance', 'The valley floods; the dam hum under it.'),
    (58.85, 'door, rain', 'Hensel\'s door opening in the rain.'),
    (61.15, 'temporal switch (transition)', 'Into 2196: wind, birds, a far bell.'),
    (70.2, 'three notes on glass', 'E-B-A tapped on the gallery glass (the game\'s glass voice), 0.55 s apart.'),
    (75.0, 'heartbeat at 08:14', 'As Meridian freezes; then the rewind ripple.'),
    (79.07, 'Echo Step', 'Afterimage swish, a doubled transient.'),
    (81.1, 'inversion: reversed rain swell', 'Rain played backward under the upward rain.'),
    (83.14, 'returned shells', 'Reversed impacts, never a boom: incoming whistle reversed into a dry crack.'),
    (90.25, 'flood siren', 'Surge siren, one wail.'),
    (92.29, 'tower collapse groan', 'Low steel groan.'),
    (93.31, 'temporal switch (transition)', 'Into the drowned valley.'),
    (94.32, 'storm front', 'Wind roar with the anchor hum failing.'),
    (96.36, 'temporal switch (transition)', 'Into the held yards.'),
    (97.37, 'silence', '1.2 s.'),
    (98.57, 'Chronolith hum', 'Low ring hum under the final image.'),
    (111.9, 'temporal switch', 'The cut to black lands on it.'),
    (112.07, 'rain tail', 'Light rain under the end card.'),
]

# Store cut: 30 s app-preview (in-app footage only, no cards), the full 1920x886 render frame. in = seconds into the
# shot clip (clips/<id>.mp4 starts at the head handle).
STORE = [('s01', 1.0, 3.6), ('s07', 0.6, 3.0), ('s11', 0.9, 3.5), ('s14', 1.2, 3.5), ('s17', 0.8, 3.0), ('s21', 0.4, 2.0),
         ('s22', 0.5, 2.0), ('s23', 0.4, 2.0), ('s28', 0.2, 1.5), ('s30', 0.2, 1.5), ('s35', 0.5, 4.4)]

# what the recorder draws (the store-cut crop, 2.167:1). 1280 wide is what the render farm can afford: m1 street, high
# tier, under the shared load: 1280x720 5.7 s/frame alone, 16-18 s with two renderers; 1920x1080 18.3 s alone,
# 29-30 s with two (docs/TRAILER.md, "Director"). The edit scales the 2.39 band up to the 1920x1080 output.
RENDER = dict(width=1280, height=590, gfx='high')
OUTPUT = dict(width=1920, height=1080, letterbox=2.39, active_height=804)   # what the trailer delivers


def fnv36(s):
    h = 2166136261
    for ch in s:
        for cu in (ch.encode('utf-16-le')[i:i + 2] for i in range(0, len(ch.encode('utf-16-le')), 2)):
            h ^= int.from_bytes(cu, 'little'); h = (h * 16777619) & 0xffffffff
    d, o = '0123456789abcdefghijklmnopqrstuvwxyz', ''
    while True:
        o = d[h % 36] + o; h //= 36
        if not h: return o


def build():
    man = json.load(open(os.path.join(ROOT, 'assets', 'voice', 'manifest.json')))
    timeline, order, cards, hits = [], [], [], []
    t = 0.0; f0 = 0
    for e in EDL:
        f1 = round((t + e[2]) * FPS); t += e[2]
        start, dur = f0 / FPS, (f1 - f0) / FPS
        if e[0] == 'shot':
            timeline.append(dict(t=round(start, 3), dur=round(dur, 3), shot=e[1], transition=e[3], frames=f1 - f0, at_frame=f0))
            order.append(e[1])
        else:
            timeline.append(dict(t=round(start, 3), dur=round(dur, 3), card=e[1], transition=e[3], frames=f1 - f0, at_frame=f0))
            cards.append(dict(id=e[1], t=round(start, 3), dur=round(dur, 3), text=e[4], style=e[5]))
        f0 = f1
    length = round(f0 / FPS, 3)
    # hits: every cut from s06 on that lands on the score's grid, plus the silences and the title
    on_grid = {'s06', 's09', 's12', 's14', 's17', 's19', 's20', 's21', 's22', 's23', 's24', 's25', 's26', 's27', 's28', 's29',
               's30', 's31', 's32', 's33', 's34', 'silence', 's35', 'title', 'end'}
    for item in timeline:
        if item.get('shot', item.get('card')) in on_grid: hits.append(item['t'])
    vo = []
    for (vt, who, text, m, cin, cout, note) in VO:
        k = fnv36(who + '|' + text.strip())
        rec = k in man['lines']
        if who == 'oskar' and text == 'You\'re late.': pass
        vo.append(dict(t=vt, speaker=who, text=text, key=k if rec else None, key_pending=None if rec else k, mission=m,
                       clip_in=cin, clip_out=cout, notes=note))
    bounds = [i['t'] for i in timeline] + [length]
    snap = lambda x: next((round(bd, 3) for bd in bounds if abs(bd - x) <= 0.06), x)   # cues written on a cut sit on it
    music = [dict(t=snap(a), section=b, bpm=c, notes=d) for (a, b, c, d) in MUSIC]
    sfx = [dict(t=snap(a), cue=b, notes=c) for (a, b, c) in SFX]
    store = [dict(shot=s, **{'in': i}, dur=d) for (s, i, d) in STORE]
    return dict(title='AFTERZERO · theatrical trailer', fps=FPS, width=OUTPUT['width'], height=OUTPUT['height'], length=length,
                render=RENDER, output=OUTPUT, handles=HANDLES, order=order, timeline=timeline, vo=vo, cards=cards, music=music,
                hits=hits, silences=[dict(t=snap(19.75), dur=1.0, what='the Zero Second'), dict(t=next(c['t'] for c in cards if c['id'] == 'silence'), dur=1.2, what='before the final image')],
                sfx=sfx, store_cut=store, store_cut_size=[RENDER['width'], RENDER['height']])


def write(check=False):
    data = build()
    cut = {i['shot']: i['frames'] for i in data['timeline'] if 'shot' in i}
    groups = {f'g{k}': [] for k in range(1, 7)}
    problems = []
    for sid in data['order']:
        if sid not in SHOTS: problems.append('no shot definition: ' + sid)
    for sid, s in sorted(SHOTS.items()):
        if sid not in cut: problems.append('shot not in the EDL: ' + sid); continue
        frames = cut[sid] + 2 * HANDLES
        keys = s['camera'].get('keys') or []
        if keys and keys[-1]['t'] * FPS < frames - 1 - 0.01 and s['camera']['mode'] == 'path':
            problems.append(f'{sid}: camera keys end at {keys[-1]["t"]} s, recording is {frames / FPS:.2f} s')
        out = dict(id=sid, group=s['group'], mission=s['mission'], beat=s['beat'], url=s['url'], ready=s['ready'],
                   setup=s['setup'], frames=frames, handles=HANDLES, fps=FPS, cut_frames=cut[sid],
                   camera=s['camera'], actions=s['actions'], grade=s['grade'], approved=False,
                   characters=s['characters'], lighting=s['lighting'], sound=s['sound'], notes=s['notes'])
        groups[s['group']].append(out)
    for p in problems: print('PROBLEM', p)
    if check: return data, groups
    with open(os.path.join(OUT, 'trailer.json'), 'w') as f: json.dump(data, f, indent=1, ensure_ascii=False)
    for g, lst in groups.items():
        lst.sort(key=lambda s: data['order'].index(s['id']))
        with open(os.path.join(OUT, 'shots', g + '.json'), 'w') as f: json.dump({'shots': lst}, f, indent=1, ensure_ascii=False)
    print('length', data['length'], 's ·', len(data['order']), 'shots')
    for g, lst in groups.items(): print(g, len(lst), 'shots', sum(s['frames'] for s in lst), 'frames', ' '.join(s['id'] for s in lst))
    return data, groups



def fmt_t(t):
    return f'{int(t // 60)}:{t % 60:05.2f}'

SPEC = """## The shot spec (the contract)

`tools/trailer/trailer.json` is the edit and the beat map. `tools/trailer/shots/gN.json` holds the shots, one group
per recorder agent. These are the fields everyone reads. New fields may be added; existing fields are never renamed.

**trailer.json**: `fps` 24 · `width`/`height` are the **output** (1920×1080) · `length` (s) · `order` (shot ids in
edit order) · `timeline[]` `{t, dur, shot | card, transition: cut | dissolve | dip | switch, frames, at_frame}` ·
`vo[]` `{t, speaker, text, key, mission, key_pending, clip_in, clip_out, notes}` · `cards[]` `{id, t, dur, text,
style: black | line | title | end}` · `music[]` `{t, section, bpm (null = free time), notes}` · `hits[]` (s) ·
`silences[]` `{t, dur, what}` · `sfx[]` `{t, cue, notes}` · `store_cut[]` `{shot, in, dur}` (in = seconds into the shot
clip, which starts at the head handle) · extensions: `render` `{width 1920, height 886, gfx}` (what the recorder
draws), `output` `{width, height, letterbox 2.39, active_height 804}`, `handles`, `store_cut_size`.

- `transition` says how an event **begins**. `dip` comes up from black over 6 frames. `dissolve` is a 6-frame cross
  dissolve. `switch` is a hard cut in which the last 4 frames of the outgoing shot and the first 4 frames of the
  incoming shot carry the game's switch distortion (render it with `DIR.shift`, or let the edit add a matching
  warp), and the switch stinger lands on the cut.
- `vo[].key` is the recorded clip `assets/voice/<key>.m4a`, or null when the line has not been recorded yet. In that
  case `key_pending` is the key the voice build will give it (FNV-1a of "speaker|text", base 36, as in
  src/core/voice.js). `clip_in` and `clip_out` trim a longer recorded line to the part the trailer uses. The cut
  points were found with ffmpeg `silencedetect`.

**shots/gN.json** `{shots: [...]}`, one per shot: `id`, `group`, `mission`, `beat`, `url` (relative to the static
server, always `index.html?m=<mission-1>&dtcap=0.25&gfx=high&auto`), `ready` (JS that is true when the mission can be
staged), `setup[]`, `frames` (cut + 2 × handles), `handles` 12, `camera`, `actions[]`, `grade`, `approved` (false
until a reviewer passes the shot's frames), `notes`. Extensions: `fps`, `cut_frames`, `characters`, `lighting`,
`sound`.

- `setup[]` runs once after `ready`, before frame 0. Each step is one of: `{eval: js}`; `{down|up|press: KeyCode}`;
  `{wait: s}` (simulated game seconds, not drawn); `{until: js, timeout: s}`. `wait` and `until` take an optional
  `pace`: by default setup runs no faster than real time (`pace` 1), because mission scripts mix game time with
  wall-clock waits (dialogue autoplay, `temporal.switchTo`) the way `tools/tests/*.json` playthroughs expect. `pace` 0
  runs flat out.
- `actions[]` `{t, eval | down | up | press}` run before the frame at shot time `t`. Shot time is seconds from frame 0,
  and frame 0 is the first frame of the head handle, so the cut-in is at t = 0.5 s.
- `camera.mode`:
  - `path`: keyframes `{t, p, l, fov (vertical, for the 1920×886 frame), roll (deg), focus (m or null)}`. The global
    `ease` (`inOut` | `sine` | `linear` | `in` | `out`) runs from the first key to the last. Positions go through
    Catmull-Rom, so multi-key moves never stop at a key. `shake` 0..1 adds a smooth hand-held drift.
    Extensions: `anchor` (JS for a moving point, such as a character root or a bone; the keys are then offsets from
    it), `anchorLive` (re-read the anchor every frame, default true), `focusOn` (JS for the depth-of-field
    target, which overrides `focus`), and `hold` (true also parks the pose in `game.cine`. Leave it off: several
    missions treat `game.cine` as "a cutscene is running" and pause, for example the Meridian reset).
  - `follow`: the game's own third-person camera behind Kai, driven by scripted input. `camera.orbit {yaw, pitch,
    dist}` sets it at frame 0.
  - `game`: the mission's own cinematic camera (`game.shot`) as authored.
- `grade`: the engine's era grade, set at frame 0 (`engine.setGrade`, settled). An action can change it mid-shot (the
  era-switch shots do), and it blends over about a second.

## How shots are reached and staged (tools/trailer/director.js)

The recorder loads `url` and waits for `ready`. It then evaluates `tools/trailer/director.js` in the page, which
takes over the frame loop the way `tools/render/refhelper.js` does: frames are only simulated and drawn on request.
Then it runs `setup[]`, calls `DIR.begin(shot)` and, for each frame, runs the due `actions` and `DIR.frame(i, true)`.
That call steps the game exactly 1/24 s, poses the camera, draws, and returns the frame. Between frames the page
must get at least one `requestAnimationFrame` turn: mission scripts await `game.wait` / `waitFor` through rAF polling,
and stall if frames are stepped back to back without yielding. `preview.mjs` waits 18 ms after each undrawn frame. `tools/trailer/preview.mjs`
does exactly this at 640×296 for three frames per shot (cut-in, middle, cut-out). It writes one strip per shot for
review:

    node tools/trailer/preview.mjs g3 [--shots=s10,s11] [--w=640] [--h=296] [--at=in,mid,out|keys|0,40] [--resume]

Director helpers the shots use:

- `DIR.era(id, dur)`: an era switch driven by **game time**. The game's `temporal.switchTo` animates its distortion
  on wall time, which a frame-stepped capture would skip. This helper raises `uShift`, swaps the era at the midpoint
  (visibility, `apply()`, the `onSwitch` listeners, the band flare) and lowers it again.
- `DIR.actor(id)`, `DIR.freeze(on)`, `DIR.pose(p, l, fov, roll)`, `DIR.sim(s)`, `DIR.until(js, timeout)`.
- Staging at run time, with no game code changed: place Kai (`player.place`), bring a character back or turn them
  (`actors.rook.root…`), set `lookTarget`, play a pose clip (`char.pose = 'work' | 'look' | …`), lip movement on a
  trailer VO line (`char.talk = seconds`), the band flare (`char.wristBoost`), the Chronolith core power (the ring's
  `userData.disc` uniform), dimming the mission 1 shop-window canvases, firing mission 13's return-ring tracers
  (`__m13.W.tracer`), Echo Step (`__m12.echo.trigger()`), and jumping the Meridian loop (`loopState.active.skipTo`,
  through a dynamic import of `/src/systems/loops.js`, which is the same module instance the game uses).
- Missions that expose debug handles: `window.__m12`, `__m13` and `__m18` (`ch3`). Mission 18 starts at a chapter with
  `&m18part=N`.
"""

def doc(data, groups):
    sh = {s['id']: s for g in groups.values() for s in g}
    L = ['<!-- BEGIN GENERATED (tools/trailer/storyboard.py) -->', '', '## Beat map', '',
         f'Total **{data["length"]:.2f} s** ({round(data["length"] * FPS)} frames at {FPS} fps), {len(data["order"])} shots, '
         f'{len(data["cards"])} cards. Hits (cuts on the score\'s grid): ' + ', '.join(f'{h:.2f}' for h in data['hits']) + '.', '',
         '| time | dur | picture | in | VO (speaker: line) | music | sound |', '|---|---|---|---|---|---|---|']
    for it in data['timeline']:
        t0, t1 = it['t'], it['t'] + it['dur']
        vo = '<br>'.join(f'{v["t"]:.2f} {v["speaker"]}: "{v["text"] if v["clip_in"] is None else "(trim) " + v["text"]}"' for v in data['vo'] if t0 <= v['t'] < t1)
        mu = '<br>'.join(f'{m["t"]:.2f} **{m["section"]}**' + (f' ({m["bpm"]} BPM)' if m['bpm'] else '') for m in data['music'] if t0 <= m['t'] < t1)
        sf = '<br>'.join(f'{x["t"]:.2f} {x["cue"]}' for x in data['sfx'] if t0 <= x['t'] < t1)
        if 'shot' in it:
            s = sh[it['shot']]; pic = f'**{s["id"]}** (M{s["mission"]}) {s["beat"]}'
        else:
            c = next(c for c in data['cards'] if c['id'] == it['card'])
            pic = f'*card {c["id"]}*: ' + (c['text'].replace(chr(10), ' / ') if c['text'] else '(black)')
        L.append(f'| {fmt_t(t0)} | {it["dur"]:.2f} | {pic} | {it["transition"]} | {vo} | {mu} | {sf} |')
    L += ['', '## Shot list', '',
          'Times are trailer times. `rec` is the recorded length including both handles. Camera keys and actions are in '
          'the group files.', '',
          '| shot | group | mission | trailer | cut (fr) | rec (fr) | camera | grade | on screen | light and mood |', '|---|---|---|---|---|---|---|---|---|---|']
    for sid in data['order']:
        s = sh[sid]; it = next(i for i in data['timeline'] if i.get('shot') == sid); c = s['camera']
        k = c.get('keys') or []
        cam = f'{c["mode"]}, {len(k)} keys, fov {k[0]["fov"]}→{k[-1]["fov"]}' + (', anchored' if c.get('anchor') else '') + (f', shake {c["shake"]}' if c.get('shake') else '')
        L.append(f'| {sid} | {s["group"]} | {s["mission"]} | {fmt_t(it["t"])} | {s["cut_frames"]} | {s["frames"]} | {cam} | {s["grade"]} | {s["characters"]} | {s["lighting"]} |')
    L += ['', '### Groups', '', '| group | shots | frames | missions |', '|---|---|---|---|']
    for g, lst in groups.items():
        L.append(f'| {g} | {" ".join(s["id"] for s in lst)} | {sum(s["frames"] for s in lst)} | {", ".join(sorted({str(s["mission"]) for s in lst}, key=int))} |')
    L += ['', '### How each shot is reached', '']
    for sid in data['order']:
        s = sh[sid]
        steps = '; '.join((f'eval `{x["eval"][:90]}{"…" if len(x["eval"]) > 90 else ""}`' if 'eval' in x else
                           f'wait {x["wait"]} s' if 'wait' in x else f'until `{x["until"][:80]}` ({x.get("timeout", 60)} s)' if 'until' in x else
                           ', '.join(f'{kk} {vv}' for kk, vv in x.items())) for x in s['setup'])
        acts = '; '.join(f't {a["t"]}: ' + (f'`{a["eval"][:70]}`' if 'eval' in a else ', '.join(f'{kk} {vv}' for kk, vv in a.items() if kk != 't')) for a in s['actions'])
        L.append(f'- **{sid}** `{s["url"]}`. Setup: {steps or "none"}.' + (f' Actions: {acts}.' if acts else '') + (f' {s["notes"]}' if s['notes'] else ''))
    L += ['', '## VO script', '', 'Every line is the game\'s own: exact text and speaker id, so the recorded clip is reused.', '',
          '| time | speaker | line | mission | recorded key | trim |', '|---|---|---|---|---|---|']
    for v in data['vo']:
        key = f'`{v["key"]}`' if v['key'] else f'(not recorded; pending `{v["key_pending"]}`)'
        trim = f'{v["clip_in"]}–{v["clip_out"]} s' if v['clip_in'] is not None else ''
        L.append(f'| {v["t"]:.2f} | {v["speaker"]} | {v["text"]} | {v["mission"]} | {key} | {trim} |')
    L += ['', '## Music map', '', '| time | section | BPM | direction |', '|---|---|---|---|']
    for m in data['music']: L.append(f'| {m["t"]:.2f} | {m["section"]} | {m["bpm"] or "free"} | {m["notes"]} |')
    L += ['', '## Sound-design cues', '', '| time | cue | notes |', '|---|---|---|']
    for x in data['sfx']: L.append(f'| {x["t"]:.2f} | {x["cue"]} | {x["notes"]} |')
    L += ['', '## Store cut (30 s)', '',
          'App-preview style: in-app footage only, no cards and no letterbox, the full 1920×886 frame (crop the 1080 '
          'output never; cut from the shot clips). `in` is seconds into the shot clip.', '',
          '| # | shot | in | dur | starts at |', '|---|---|---|---|---|']
    acc = 0.0
    for n, x in enumerate(data['store_cut'], 1):
        L.append(f'| {n} | {x["shot"]} | {x["in"]} | {x["dur"]} | {acc:.1f} |'); acc += x['dur']
    L += [f'', f'Total {acc:.1f} s. Audio: the montage cue from 75.0 s, re-cut to 30 s and ending on the title chord, '
          'with no VO except "You have nine minutes." Store rules forbid on-screen text that is not in the app.', '', SPEC,
          '<!-- END GENERATED -->']
    path_md = os.path.join(ROOT, 'docs', 'TRAILER.md')
    txt = open(path_md).read()
    a, b = txt.index('<!-- BEGIN GENERATED'), txt.index('<!-- END GENERATED -->') + len('<!-- END GENERATED -->')
    open(path_md, 'w').write(txt[:a] + '\n'.join(L) + txt[b:])


if __name__ == '__main__':
    data, groups = write(check='--check' in sys.argv)
    if '--check' not in sys.argv: doc(data, groups)
