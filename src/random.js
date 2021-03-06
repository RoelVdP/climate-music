export const randRange = (minimum, maximum, rng) => {
  let min = minimum;
  let max = maximum;
  if (typeof minimum === 'object') {
    min = minimum[0];
    max = minimum[1];
  }
  return min + Math.floor((rng || Math.random)() * (max - min + 1));
};

export const randFloat = (minimum, maximum) => {
  let min = minimum;
  let max = maximum;
  if (typeof minimum === 'object') {
    min = minimum[0];
    max = minimum[1];
  }
  return min + Math.random() * (max - min);
};

export const rand = value => Math.random() < (value / 100.0);

export const maybe = (prob, opt1, opt2) => {
  if (typeof prob === 'number') {
    return rand(prob) ? opt1 : opt2;
  }
  let sum = 0;
  let chosen = null;
  const sorted = Object.keys(prob).sort((a, b) => {
    if (a === 'rest') {
      return 1;
    } else if (b === 'rest') {
      return -1;
    }
    return a - b;
  });
  sorted.forEach(key => {
    sum += (key === 'rest' ? (100 - sum) : Number(key));
    if (chosen === null && rand(sum)) {
      chosen = prob[key];
    }
  });
  return chosen;
};

export const sample = arr =>
  (arr.length > 0 ? arr[randRange(0, arr.length - 1)] : undefined);

export const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length; i; i--) {
    const j = Math.floor(Math.random() * i);
    [a[i - 1], a[j]] = [a[j], a[i - 1]];
  }
  return a;
};
