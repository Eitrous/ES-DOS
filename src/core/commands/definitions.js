import { ROOT_PATH } from '../filesystem/data.js';
import {
  findByName,
  getDirectoryByPath,
  inferFileSize,
  inferFileType,
  listDirectory,
  normalizePath,
  readFileByPath,
} from '../filesystem/service.js';

const REDIRECT_DELAY_MS = 2000;
const FILE_NAME_WIDTH = 12;
const FILE_TYPE_WIDTH = 12;
const FILE_SIZE_WIDTH = 12;

function formatDirEntry(name, node) {
  const nameCell = name.padEnd(FILE_NAME_WIDTH, ' ');

  if (node.type === 'DIR') {
    return `${nameCell} ${' '.repeat(10)}<DIR>${' '.repeat(10)}`;
  }

  const typeCell = inferFileType(name, node).padEnd(FILE_TYPE_WIDTH, ' ');
  const sizeCell = inferFileSize(node).padStart(FILE_SIZE_WIDTH, ' ');

  return `${nameCell} ${typeCell} ${sizeCell}`;
}

function findCommandByName(commandDefinitions, commandName) {
  const normalizedName = String(commandName ?? '').toUpperCase();

  return commandDefinitions.find((command) => {
    if (command.name === normalizedName) {
      return true;
    }

    return (command.aliases || []).some(
      (alias) => alias.toUpperCase() === normalizedName,
    );
  });
}

function createRedirectResult(message, url) {
  return {
    output: [message],
    redirect: {
      url,
      delayMs: REDIRECT_DELAY_MS,
    },
  };
}

export function createCommandDefinitions() {
  return [
    {
      name: 'HELP',
      aliases: [],
      description: 'Show this command list',
      usage: 'HELP [command]',
      execute: ({ commandDefinitions }, parsed) => {
        const targetCommand = parsed.positionalArgs[0];

        if (targetCommand) {
          const foundCommand = findCommandByName(commandDefinitions, targetCommand);
          if (!foundCommand) {
            return {
              output: [`Unknown command: ${targetCommand.toUpperCase()}`],
            };
          }

          return {
            output: [
              `${foundCommand.name} - ${foundCommand.description}`,
              `Usage: ${foundCommand.usage}`,
            ],
          };
        }

        const output = ['Supported Commands:'];
        const sortedCommands = [...commandDefinitions].sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        sortedCommands.forEach((command) => {
          output.push(`  ${command.name.padEnd(7, ' ')} - ${command.description}`);
        });

        return { output };
      },
    },
    {
      name: 'VER',
      aliases: [],
      description: 'Display version',
      usage: 'VER',
      execute: () => ({
        output: ['ES-DOS version 1.00'],
      }),
    },
    {
      name: 'CLS',
      aliases: [],
      description: 'Clear the screen',
      usage: 'CLS',
      execute: () => ({
        clearScreen: true,
        output: [],
      }),
    },
    {
      name: 'DIR',
      aliases: [],
      description: 'List files and directories',
      usage: 'DIR [path]',
      execute: ({ currentPath, fileSystem }, parsed) => {
        const targetArg = parsed.positionalArgs[0];
        const targetPath = targetArg
          ? normalizePath(targetArg, currentPath)
          : normalizePath(currentPath, ROOT_PATH);

        const entries = listDirectory(fileSystem, targetPath);
        if (!entries) {
          return {
            output: ['   Directory not found error.'],
          };
        }

        const output = [`\n   Directory Of ${targetPath}`, '\n'];

        if (targetPath !== ROOT_PATH) {
          output.push('.                      <DIR>');
          output.push('..                     <DIR>');
        }

        entries.forEach(({ name, node }) => {
          output.push(formatDirEntry(name, node));
        });

        const fileCount = entries.filter((entry) => entry.node.type !== 'DIR').length;
        output.push('', `${String(fileCount).padStart(30, ' ')} file(s)`);

        return { output };
      },
    },
    {
      name: 'CD',
      aliases: [],
      description: 'Open directory',
      usage: 'CD [path]',
      execute: ({ currentPath, fileSystem }, parsed) => {
        const targetArg = parsed.positionalArgs[0];

        if (!targetArg) {
          return {
            output: [currentPath],
          };
        }

        const nextPath = normalizePath(targetArg, currentPath);
        const nextDirectory = getDirectoryByPath(fileSystem, nextPath);

        if (!nextDirectory) {
          return {
            output: ['Invalid directory'],
          };
        }

        return {
          output: [],
          nextPath,
        };
      },
    },
    {
      name: 'TYPE',
      aliases: [],
      description: 'Display text file content',
      usage: 'TYPE <file>',
      execute: ({ currentPath, fileSystem }, parsed) => {
        const targetArg = parsed.positionalArgs[0];

        if (!targetArg) {
          return {
            output: ['Usage: TYPE <file>'],
          };
        }

        const targetPath = normalizePath(targetArg, currentPath);
        const result = readFileByPath(fileSystem, targetPath);

        if (result.error === 'NOT_FOUND') {
          return {
            output: ['File not found'],
          };
        }

        if (result.error === 'IS_DIRECTORY') {
          return {
            output: ['Access denied'],
          };
        }

        if (typeof result.node.content !== 'string') {
          return {
            output: ['File has no readable text content'],
          };
        }

        return {
          output: result.node.content.split(/\r?\n/),
        };
      },
    },
    {
      name: 'FIND',
      aliases: [],
      description: 'Find files and folders by name',
      usage: 'FIND <name> [/S] [path]',
      execute: ({ currentPath, fileSystem }, parsed) => {
        const searchName = parsed.positionalArgs[0];

        if (!searchName) {
          return {
            output: ['Usage: FIND <name> [/S] [path]'],
          };
        }

        const targetPathArg = parsed.positionalArgs[1];
        const targetPath = targetPathArg
          ? normalizePath(targetPathArg, currentPath)
          : normalizePath(currentPath, ROOT_PATH);

        const targetDirectory = getDirectoryByPath(fileSystem, targetPath);
        if (!targetDirectory) {
          return {
            output: ['Invalid directory'],
          };
        }

        const recursive = Boolean(parsed.flags.S);
        const matches = findByName(fileSystem, targetPath, searchName, {
          recursive,
        });

        if (!matches || matches.length === 0) {
          return {
            output: [`No files found matching "${searchName}"`],
          };
        }

        const output = [
          `Search results in ${targetPath}${recursive ? ' (recursive)' : ''}:`,
        ];

        matches.forEach((match) => {
          const kind = match.node.type === 'DIR' ? '<DIR>' : inferFileType(match.name, match.node);
          output.push(`  ${match.path} ${kind}`);
        });

        output.push('', `${matches.length} match(es)`);

        return { output };
      },
    },
    {
      name: 'EXIT',
      aliases: [],
      description: 'Return to Eindows 98',
      usage: 'EXIT',
      execute: () => createRedirectResult('Eindows is now restarting...', 'https://os.0x3f.io'),
    },
    {
      name: 'WIN',
      aliases: [],
      description: 'Return to Eindows 98',
      usage: 'WIN',
      execute: () => createRedirectResult('Eindows is now restarting', 'https://os.0x3f.io'),
    },
    {
      name: 'REBOOT',
      aliases: [],
      description: 'Restart ES-DOS',
      usage: 'REBOOT',
      execute: () => createRedirectResult('ES-DOS is now restarting', 'https://dos.0x3f.io'),
    },
    {
      name: 'GITHUB',
      aliases: [],
      description: 'Open GitHub repository',
      usage: 'GITHUB',
      execute: () => createRedirectResult('Redirecting...', 'https://github.com/Eitrous/ES-DOS'),
    },
    {
      name: 'BLOG',
      aliases: [],
      description: 'Open 0x3f blog',
      usage: 'BLOG',
      execute: () => createRedirectResult('Redirecting...', 'https://blog.0x3f.io'),
    },
  ];
}
