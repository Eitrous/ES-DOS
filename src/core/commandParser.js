function tokenizeInput(input) {
  const tokens = [];
  let currentToken = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const character = input[i];

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (/\s/.test(character) && !inQuotes) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
      continue;
    }

    currentToken += character;
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  return tokens;
}

function parseFlagToken(token) {
  const flagBody = token.slice(1);
  const separatorIndex = flagBody.indexOf(':');

  if (separatorIndex === -1) {
    return {
      name: flagBody.toUpperCase(),
      value: true,
    };
  }

  const flagName = flagBody.slice(0, separatorIndex).toUpperCase();
  const flagValue = flagBody.slice(separatorIndex + 1);

  return {
    name: flagName,
    value: flagValue.length === 0 ? true : flagValue,
  };
}

export function parseCommandInput(rawInput) {
  const source = String(rawInput ?? '');
  const tokens = tokenizeInput(source.trim());

  if (tokens.length === 0) {
    return {
      rawInput: source,
      command: '',
      tokens: [],
      positionalArgs: [],
      flags: {},
    };
  }

  const [rawCommand, ...argTokens] = tokens;
  const command = rawCommand.toUpperCase();
  const positionalArgs = [];
  const flags = {};

  argTokens.forEach((token) => {
    if (token.startsWith('/') && token.length > 1) {
      const parsedFlag = parseFlagToken(token);
      flags[parsedFlag.name] = parsedFlag.value;
      return;
    }

    positionalArgs.push(token);
  });

  return {
    rawInput: source,
    command,
    tokens,
    positionalArgs,
    flags,
  };
}
