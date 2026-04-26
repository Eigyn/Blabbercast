const util = require('util');

function formatArg(arg) {
  if (arg instanceof Error) {
    return arg.stack || arg.message;
  }

  if (typeof arg === 'string') {
    return arg;
  }

  return util.inspect(arg, {
    depth: 4,
    breakLength: Infinity,
    compact: true,
    colors: false
  });
}

function createLogRelay(broadcast, options = {}) {
  const limit = Number.isInteger(options.limit) ? options.limit : 300;
  const entries = [];
  let sequence = 0;

  const originals = {
    log: console.log.bind(console),
    info: (console.info || console.log).bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };

  function push(level, args) {
    const message = args.map(formatArg).join(' ');
    const entry = {
      id: `${Date.now().toString(36)}-${(sequence++).toString(36)}`,
      level,
      message,
      timestamp: Date.now()
    };

    entries.push(entry);
    if (entries.length > limit) {
      entries.shift();
    }

    if (typeof broadcast === 'function') {
      try {
        broadcast({ type: 'log', data: entry });
      } catch {
        // Keep logging available even if websocket broadcast fails.
      }
    }
  }

  for (const level of Object.keys(originals)) {
    console[level] = (...args) => {
      originals[level](...args);
      push(level, args);
    };
  }

  return {
    getEntries() {
      return entries.slice();
    }
  };
}

module.exports = createLogRelay;
