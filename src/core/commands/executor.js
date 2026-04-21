import { parseCommandInput } from '../commandParser.js';
import { ROOT_PATH } from '../filesystem/data.js';
import { createCommandDefinitions } from './definitions.js';

function buildCommandMap(commandDefinitions) {
  const commandMap = new Map();

  commandDefinitions.forEach((command) => {
    const commandName = command.name.toUpperCase();
    commandMap.set(commandName, command);

    (command.aliases || []).forEach((alias) => {
      commandMap.set(alias.toUpperCase(), command);
    });
  });

  return commandMap;
}

export function createCommandExecutor({ fileSystem }) {
  const commandDefinitions = createCommandDefinitions();
  const commandMap = buildCommandMap(commandDefinitions);

  const execute = ({ input, currentPath = ROOT_PATH }) => {
    const parsedCommand = parseCommandInput(input);

    if (!parsedCommand.command) {
      return {
        output: [],
        clearScreen: false,
        shouldEnableInput: true,
      };
    }

    const commandDefinition = commandMap.get(parsedCommand.command);

    if (!commandDefinition) {
      return {
        output: ['Bad command or file name'],
        clearScreen: false,
        shouldEnableInput: true,
      };
    }

    try {
      const executionResult =
        commandDefinition.execute(
          {
            fileSystem,
            currentPath,
            commandDefinitions,
          },
          parsedCommand,
        ) || {};

      return {
        output: Array.isArray(executionResult.output) ? executionResult.output : [],
        nextPath: executionResult.nextPath,
        clearScreen: Boolean(executionResult.clearScreen),
        redirect: executionResult.redirect,
        shouldEnableInput: !executionResult.redirect,
      };
    } catch {
      return {
        output: ['Command failed unexpectedly'],
        clearScreen: false,
        shouldEnableInput: true,
      };
    }
  };

  return {
    execute,
    commandDefinitions,
  };
}
