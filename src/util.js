const output = from => (from.output ? from.output : from);
const input = to => (to.input ? to.input : to);

export const connect = (from, to, outputIndex = 0, inputIndex = 0) => {
  output(from).connect(input(to), outputIndex, inputIndex);
};

export const disconnect = (node, from) => {
  const src = output(node);
  const dest = input(from);
  if (from) {
    src.disconnect(dest);
    return;
  }
  src.disconnect();
};
