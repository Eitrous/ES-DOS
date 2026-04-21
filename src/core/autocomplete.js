import { getDirectoryByPath, normalizePath } from './filesystem/service.js';

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

  return {
    tokens,
    inQuotes,
  };
}

function getCommonPrefix(values) {
  if (!values || values.length === 0) {
    return '';
  }

  let prefix = values[0];

  for (let i = 1; i < values.length; i += 1) {
    const value = values[i];
    let index = 0;

    while (
      index < prefix.length &&
      index < value.length &&
      prefix[index].toUpperCase() === value[index].toUpperCase()
    ) {
      index += 1;
    }

    prefix = prefix.slice(0, index);

    if (!prefix) {
      return '';
    }
  }

  return prefix;
}

function formatToken(token) {
  if (token.includes(' ')) {
    return `"${token}"`;
  }

  return token;
}

function getCommandNames(commandDefinitions) {
  const commandNameSet = new Set();

  (commandDefinitions || []).forEach((definition) => {
    if (definition.name) {
      commandNameSet.add(definition.name.toUpperCase());
    }

    (definition.aliases || []).forEach((alias) => {
      commandNameSet.add(alias.toUpperCase());
    });
  });

  return [...commandNameSet].sort((a, b) => a.localeCompare(b));
}

function completeCommandToken(input, commandPrefix, commandDefinitions) {
  const uppercasePrefix = commandPrefix.toUpperCase();
  const commandNames = getCommandNames(commandDefinitions);
  const matches = commandNames.filter((name) =>
    name.startsWith(uppercasePrefix),
  );

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return {
      nextInput: `${matches[0]} `,
      suggestions: null,
    };
  }

  const commonPrefix = getCommonPrefix(matches);

  if (commonPrefix.length > uppercasePrefix.length) {
    return {
      nextInput: commonPrefix,
      suggestions: null,
    };
  }

  return {
    nextInput: input,
    suggestions: matches,
    cycleInputs: matches.map((name) => `${name} `),
  };
}

function getPathCompletionOptions(token, currentPath, fileSystem) {
  const normalizedToken = String(token ?? '').replace(/\//g, '\\');
  const separatorIndex = normalizedToken.lastIndexOf('\\');

  const pathPrefix =
    separatorIndex === -1 ? '' : normalizedToken.slice(0, separatorIndex + 1);
  const parentToken =
    separatorIndex === -1 ? '.' : normalizedToken.slice(0, separatorIndex);
  const currentNamePrefix =
    separatorIndex === -1
      ? normalizedToken
      : normalizedToken.slice(separatorIndex + 1);

  const searchPath = normalizePath(parentToken || '.', currentPath);
  const directory = getDirectoryByPath(fileSystem, searchPath);

  if (!directory) {
    return null;
  }

  const children = Object.keys(directory.children || {}).map((name) => ({
    name,
    node: directory.children[name],
  }));

  const uppercasePrefix = currentNamePrefix.toUpperCase();
  const matches = children
    .filter((child) => child.name.toUpperCase().startsWith(uppercasePrefix))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (matches.length === 0) {
    return null;
  }

  return {
    pathPrefix,
    currentNamePrefix,
    matches,
  };
}

function completePathToken(token, currentPath, fileSystem) {
  const completionOptions = getPathCompletionOptions(token, currentPath, fileSystem);

  if (!completionOptions) {
    return null;
  }

  const { pathPrefix, currentNamePrefix, matches } = completionOptions;

  if (matches.length === 1) {
    return {
      completedToken: `${pathPrefix}${matches[0].name}`,
      appendSpace: true,
      suggestions: null,
      candidateTokens: null,
    };
  }

  const commonPrefix = getCommonPrefix(matches.map((match) => match.name));

  if (commonPrefix.length > currentNamePrefix.length) {
    return {
      completedToken: `${pathPrefix}${commonPrefix}`,
      appendSpace: false,
      suggestions: null,
    };
  }

  return {
    completedToken: token,
    appendSpace: false,
    suggestions: matches.map((match) => match.name),
    candidateTokens: matches.map((match) => `${pathPrefix}${match.name}`),
  };
}

export function getAutocompleteResult({
  input,
  currentPath,
  fileSystem,
  commandDefinitions,
}) {
  const source = String(input ?? '');
  const { tokens, inQuotes } = tokenizeInput(source);

  if (inQuotes) {
    return null;
  }

  const endsWithWhitespace = /\s$/.test(source);

  if (tokens.length === 0 || (tokens.length === 1 && !endsWithWhitespace)) {
    const commandPrefix = tokens[0] || '';
    return completeCommandToken(source, commandPrefix, commandDefinitions);
  }

  const commandToken = tokens[0];
  const args = tokens.slice(1);
  const activeToken = endsWithWhitespace ? '' : args[args.length - 1] || '';
  const lockedArgs = endsWithWhitespace ? args : args.slice(0, -1);

  if (activeToken.startsWith('/')) {
    return null;
  }

  const pathCompletion = completePathToken(activeToken, currentPath, fileSystem);

  if (!pathCompletion) {
    return null;
  }

  if (
    pathCompletion.suggestions &&
    pathCompletion.completedToken === activeToken
  ) {
    const cycleInputs = (pathCompletion.candidateTokens || []).map(
      (candidateToken) => {
        const rebuiltArgs = [...lockedArgs, candidateToken]
          .map((argToken) => formatToken(argToken))
          .join(' ')
          .trim();
        const rebuiltInput = rebuiltArgs
          ? `${commandToken} ${rebuiltArgs}`
          : commandToken;

        return `${rebuiltInput} `;
      },
    );

    return {
      nextInput: source,
      suggestions: pathCompletion.suggestions,
      cycleInputs,
    };
  }

  const rebuiltArgs = [...lockedArgs, pathCompletion.completedToken]
    .map((argToken) => formatToken(argToken))
    .join(' ')
    .trim();

  const rebuiltInput = rebuiltArgs
    ? `${commandToken} ${rebuiltArgs}`
    : commandToken;

  return {
    nextInput: pathCompletion.appendSpace ? `${rebuiltInput} ` : rebuiltInput,
    suggestions: pathCompletion.suggestions,
  };
}
