import seedrandom from 'seedrandom';
import {
  randRange, randFloat, rand, sample as randSample, shuffle
} from './random';
import {addInsert, createInsertEffect} from './audio';
import createReverb from './reverb';
import {createFeedbackDelay} from './delay';
import loadSample from './loader';
import createFilter from './filter';

const TOTAL_CO2 = 8;
const TOTAL_CH4 = 9;
const TOTAL_N2O = 10;
const STD = 0;
const TREND = 1;
const JUMP = 2;

const combine = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
const normalizeTrend = val => 0.5 + val / 2;

const spread = (val, factor = 0.2) => {
  let ret = val / factor - (0.5 / factor) + 0.5;
  if (ret > 1) {
    ret = 1;
  }
  if (ret < 0) {
    ret = 0;
  }
  return ret;
};

const clampStd = val => {
  const ret = Math.log(val + 1) / 8;
  return ret;
};

export const getParams = (rawData, country) => {
  const data = rawData.data[country];
  const seed = `${country}${data[TOTAL_CH4].join('')}${data[TOTAL_CO2].join('')}`;
  const rng = seedrandom(seed);
  const brightness = normalizeTrend(-1 *
    combine([data[TOTAL_CH4][TREND], data[TOTAL_CO2][TREND]]));
  const std = clampStd(combine([data[TOTAL_CH4][STD], data[TOTAL_CO2][STD]]));
  const no2trend = spread(normalizeTrend(data[TOTAL_N2O][TREND]));
  const ch4trend = spread(normalizeTrend(data[TOTAL_CH4][TREND]));
  const mellowness =
    Math.abs(combine([data[TOTAL_CH4][JUMP], data[TOTAL_CO2][JUMP]]) - 0.05);
  const padLen = 96 + mellowness * 2 * 64;
  return {
    rng,
    PEDAL: {
      pitch: [-7, 4],
      reverb: [1, 4],
      sample: [1, 4],
      length: [12, 64],
      velocity: [100, 127],
      attack: [0.1, 1.0],
      delayTime: [0.5, 1.5],
      reverbDry: [0.5, 0.8],
      reverbWet: [0.7, 0.95],
      delayWet: [0.5, 0.8],
      filterFrequency: [100 + 100 * no2trend, 500 + 4500 * no2trend],
    },
    PAD: {
      brightness,
      mellowness,
      reverb: [1, 4],
      pitch: [-7, 4],
      sample: [1, 6],
      length: [32, padLen],
      velocity: [30, 127],
      attack: [0.5, 1.0],
      delayTime: [0.5, 1.5],
      reverbDry: [0.5, 0.8],
      reverbWet: [0.7, 0.95],
      delayWet: [0.5, 0.8],
      filterFrequency: [250 + 100 * ch4trend, 600 + 7400 * ch4trend],
    },
    PERC: {
      pitch: [-12, 12],
      reverb: [1, 4],
      sample: [1, 6],
      length: [70, 200],
      velocity: [32, 127],
      feedback: [0.5, 0.8],
      delayTime: [0.5, 1.5],
      reverbDry: [0.3, 0.7],
      reverbWet: [0.7, 0.95],
      delayWet: [0.5, 0.8],
      filterFrequency: [500 + std * 10000, 9000 + std * 7000],
    }
  };
};

const commonNote = p => ({
  length: randRange(p.length),
  velocity: randRange(p.velocity),
  filterFrequency: randRange(p.filterFrequency),
});

function* generatePedal(params, root) {
  const p = params.PEDAL;
  let channel = 0;
  const pitch = root;
  const sample = `bass${randRange(p.sample, null, p.rng)}`;
  while (true) {
    channel = ++channel % 2;
    yield {
      ...commonNote(p),
      pitch,
      track: `PEDAL${channel}`,
      attack: randFloat(p.attack),
      sample,
    };
  }
}

const SCALES = [
  {name: 'locrian', priority: [0, 1, 6], rest: [3, 5, 8, 10]},
  {name: 'phrygian', priority: [0, 1, 3], rest: [5, 7, 8, 10]},
  {name: 'aeolian', priority: [0, 7, 8, 3], rest: [2, 5, 10]},
  {name: 'dorian', priority: [0, 10, 3, 5, 9], rest: [2, 7]},
  {name: 'mixolydian', priority: [0, 10, 4, 9], rest: [2, 5, 7]},
  {name: 'ionian', priority: [0, 11, 4], rest: [2, 5, 7, 9]},
  {name: 'lydian', priority: [0, 6, 7, 2, 4], rest: [9, 11]},
];

export const brightnessToScale = brightness =>
  SCALES[Math.floor(brightness * 7)];

const getOrderedScale = p => {
  const scale = brightnessToScale(p.brightness);
  return scale.priority.concat(scale.rest).sort((a, b) => a - b);
};

const getRawNote = (p, anywhere) => {
  const scale = brightnessToScale(p.brightness);
  return anywhere ? randSample(scale.priority.concat(scale.rest)) : (
    rand(30) ? randSample(scale.rest) : randSample(scale.priority)
  );
};

const getPadNote = (root, p) =>
  root + getRawNote(p) + randRange(0, 1) * 12;

const getNoteFromScale = (scale, distance) => {
  let index = distance;
  let readjust = 0;
  if (index > (scale.length - 1)) {
    index -= scale.length;
    readjust = 12;
  }
  return scale[index] + readjust;
};

const getTriad = (root, p, len) => {
  const notes = [];
  const first = getRawNote(p, true);
  notes.push(first);
  const scale = getOrderedScale(p);
  const firstIndex = scale.indexOf(first);
  const skewLeft = rand(50);
  const distance2 = firstIndex + 1;
  const distance3 = firstIndex + randRange(4, 6);
  const note2 = getNoteFromScale(scale, distance2);
  const note3 = getNoteFromScale(scale, distance3);
  notes.push(skewLeft ? note2 : note3);
  notes.push(skewLeft ? note3 : note2);
  const line = shuffle(notes);
  for (let i = line.length; i < len; ++i) {
    line.push(randSample(notes));
  }
  const octaveShift = randRange(-2, 1) * 12;
  let adjusted = line.map(i => root + i + octaveShift);
  if (Math.max(...adjusted) > 19) {
    adjusted = adjusted.map(i => i - 12);
  }
  if (Math.min(...adjusted) < -7) {
    adjusted = adjusted.map(i => i + 12);
  }
  return adjusted;
};

const P_TRIAD = 50;

function* generatePad(params, root) {
  const p = params.PAD;
  let channel = 0;
  const sample = `pad${randRange(p.sample, null, p.rng)}`;
  const clusterMode = {};
  while (true) {
    channel = ++channel % 4;
    const note = {
      ...commonNote(p),
      pitch: getPadNote(root, p),
      track: `PAD${channel}`,
      attack: randFloat(p.attack),
      sample,
    };
    if (!clusterMode.active) {
      const pCluster = 10 + (1 - p.mellowness) * 30;
      if (rand(pCluster)) {
        clusterMode.active = true;
        clusterMode.max = randRange(clusterMode.triad ? 3 : 2, 5);
        clusterMode.triad = rand(P_TRIAD) ?
          getTriad(root, p, clusterMode.max) : null;
        clusterMode.amount = 0;
      }
    }
    if (clusterMode.active) {
      if (clusterMode.triad) {
        note.pitch = clusterMode.triad[clusterMode.amount];
        note.length = randRange(4, 16);
      } else {
        note.length = randRange(1, 4);
      }
      note.velocity = randRange(50, 90);
      clusterMode.amount++;
      if (clusterMode.amount >= clusterMode.max) {
        clusterMode.active = false;
        clusterMode.triad = null;
      }
    }
    yield note;
  }
}

function* generatePerc(params) {
  const p = params.PERC;
  const sample = `perc${randRange(p.sample, null, p.rng)}`;
  const pitch = randRange(p.pitch);
  while (true) {
    yield {
      ...commonNote(p),
      pitch,
      sample,
      track: 'PERC',
    };
  }
}

const channelToParam = channel => channel.replace(/\d/g, '');

const param = (params, key, defaultValue) =>
  (params[key] ? randFloat(params[key]) : defaultValue);

const addEffects = (context, buffer, tracks, params, channels) => {
  const common = {context};
  const p = params[channelToParam(channels[0])];
  channels.forEach(channel => {
    const filter = createFilter({
      ...common,
      frequency: param(p, 'filterFrequency', 16000),
    });
    const insertFilter = createInsertEffect({
      ...common,
      effect: filter,
      dryGain: 0,
      wetGain: 1,
    });
    addInsert(context, tracks, channel, insertFilter, 0);

    const delay = createFeedbackDelay({
      ...common,
      delayTime: param(p, 'delayTime', 0.9),
      feedback: param(p, 'feedback', 0.6),
    });
    const insertDelay = createInsertEffect({
      ...common,
      effect: delay,
      dryGain: 1,
      wetGain: param(p, 'delayWet', 0.7),
    });
    addInsert(context, tracks, channel, insertDelay, 1);

    const reverb = createReverb({...common, buffer});
    const insertReverb = createInsertEffect({
      ...common,
      effect: reverb,
      dryGain: param(p, 'reverbDry', 0.6),
      wetGain: param(p, 'reverbWet', 0.6),
    });

    addInsert(context, tracks, channel, insertReverb, 2);
  });
};

const initGenerators = (oldGenerators, context, buffers, tracks, params) => {
  let buffer = `impulse${randRange(params.PEDAL.reverb)}`;
  loadSample(context, buffers, buffer)
  .then(() => {
    addEffects(context, buffers[buffer], tracks, params, ['PEDAL0', 'PEDAL1']);
  });

  buffer = `impulse${randRange(params.PAD.reverb)}`;
  loadSample(context, buffers, buffer)
  .then(() => {
    addEffects(context, buffers[buffer], tracks, params,
      ['PAD0', 'PAD1', 'PAD2', 'PAD3']);
  });

  buffer = `impulse${randRange(params.PERC.reverb)}`;
  loadSample(context, buffers, buffer)
  .then(() => {
    addEffects(context, buffers[buffer], tracks, params, ['PERC']);
  });

  const root = randRange(params.PEDAL.pitch);

  return [
    generatePedal(params, root),
    generatePad(params, root),
    generatePerc(params),
  ].map((gen, i) => ({
    gen,
    nextNoteTime: oldGenerators.length > i ? oldGenerators[i].nextNoteTime : 0,
  }));
};

export default initGenerators;
