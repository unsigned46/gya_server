const fs = require('fs');

function createDefaultState() {
  return {
    lastUpdateId: 0,
    session: null,
    weeklyPass: {
      weekKey: '',
      used: 0,
    },
  };
}

function loadState(stateFile) {
  try {
    const raw = fs.readFileSync(stateFile, 'utf-8');
    const parsed = JSON.parse(raw);
    const defaultState = createDefaultState();

    return {
      ...defaultState,
      ...parsed,
      weeklyPass: {
        ...defaultState.weeklyPass,
        ...(parsed.weeklyPass || {}),
      },
    };
  } catch {
    return createDefaultState();
  }
}

function saveState(stateFile, currentState) {
  fs.writeFileSync(stateFile, JSON.stringify(currentState, null, 2), 'utf-8');
}

function createStateStore(stateFile) {
  return {
    load: () => loadState(stateFile),
    save: (currentState) => saveState(stateFile, currentState),
  };
}

module.exports = {
  createDefaultState,
  createStateStore,
  loadState,
  saveState,
};
