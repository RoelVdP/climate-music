const getRateFromPitch = pitch => Math.pow(2, (pitch * 100) / 1200);

export default ({context, destination, buffer, pitch = 0, stopTime}) => {
  const node = context.createBufferSource();
  node.buffer = buffer;
  node.connect(destination || context.destination);
  if (pitch !== 0) {
    node.playbackRate.value = getRateFromPitch(pitch);
  }
  node.start(0);
  if (stopTime) {
    node.stop(stopTime);
  }
};
