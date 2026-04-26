const TwitchAdapter = require('./TwitchAdapter');
const YouTubeAdapter = require('./YouTubeAdapter');

const adapters = {
  twitch: TwitchAdapter,
  youtube: YouTubeAdapter
};

function createAdapter(name, config) {
  const Adapter = adapters[name];
  if (!Adapter) throw new Error(`Unknown adapter: ${name}`);
  return new Adapter(config);
}

module.exports = { createAdapter, adapters };
