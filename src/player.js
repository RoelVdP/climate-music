import playSample from './sampler';
import triggerEnvelope from './envelope';

const normalizeVelocity = (velocity, gain) => velocity * gain / 127.0;

const gateOn = (context, destination, buffer, note, stopTime) => {
  playSample({
    context,
    destination: destination.gain,
    buffer,
    pitch: note.pitch,
    stopTime,
  });
  triggerEnvelope({
    context,
    param: destination.gain.gain,
    attack: note.attack || 0.1,
    sustain: normalizeVelocity(note.velocity, destination.gainValue),
  });
};

export default (ctx, buffer, tempo, destination, note, noteLen) => {
  let stopTime;
  if (noteLen) {
    stopTime = ctx.currentTime + (noteLen * 0.25 * 60 / tempo) + 0.005;
  }
  if (buffer && destination) {
    gateOn(ctx, destination, buffer, note, stopTime);
  }
};
