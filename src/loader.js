const doRequest = url => fetch(url).then(response => response.arrayBuffer());

export default (ctx, buffers, name) =>
  new Promise(resolve => {
    if (buffers[name]) {
      resolve();
      return;
    }
    doRequest(`samples/${name}.ogg`).then(rawBuffer => {
      ctx.decodeAudioData(rawBuffer, buffer => {
        buffers[name] = buffer;
        resolve();
      }, () => {});
    });
  });
