import { ROOT_PATH } from './data.js';

const DRIVE_REGEX = /^[A-Za-z]:/;

function normalizeSeparators(value) {
  return String(value ?? '').replace(/\//g, '\\').trim();
}

function parsePathInput(input) {
  const normalized = normalizeSeparators(input);
  const hasDrive = DRIVE_REGEX.test(normalized);
  const isAbsolute = hasDrive || normalized.startsWith('\\');

  let pathWithoutDrive = normalized;
  if (hasDrive) {
    pathWithoutDrive = pathWithoutDrive.slice(2);
  }

  pathWithoutDrive = pathWithoutDrive.replace(/^\\+/, '');
  const rawSegments = pathWithoutDrive.length === 0 ? [] : pathWithoutDrive.split('\\');

  return { isAbsolute, rawSegments };
}

function resolveSegments(rawSegments, baseSegments = []) {
  const segments = [...baseSegments];

  rawSegments.forEach((segment) => {
    if (!segment || segment === '.') {
      return;
    }

    if (segment === '..') {
      if (segments.length > 0) {
        segments.pop();
      }
      return;
    }

    segments.push(segment);
  });

  return segments;
}

export function buildPathFromSegments(segments) {
  if (!segments || segments.length === 0) {
    return ROOT_PATH;
  }

  return `${ROOT_PATH}${segments.join('\\')}`;
}

export function getPathSegments(path) {
  const { rawSegments } = parsePathInput(path);
  return resolveSegments(rawSegments);
}

export function normalizePath(path, basePath = ROOT_PATH) {
  const { isAbsolute, rawSegments } = parsePathInput(path);
  const baseSegments = isAbsolute ? [] : getPathSegments(basePath);
  const resolvedSegments = resolveSegments(rawSegments, baseSegments);

  return buildPathFromSegments(resolvedSegments);
}

export function getChildByName(children, name) {
  if (!children || !name) {
    return null;
  }

  const normalizedName = name.toUpperCase();
  const matchedKey = Object.keys(children).find(
    (childName) => childName.toUpperCase() === normalizedName,
  );

  if (!matchedKey) {
    return null;
  }

  return {
    key: matchedKey,
    node: children[matchedKey],
  };
}

export function getNodeByPath(fileSystem, path) {
  const segments = getPathSegments(path);
  let current = fileSystem;

  for (const segment of segments) {
    if (!current || current.type !== 'DIR') {
      return null;
    }

    const childMatch = getChildByName(current.children, segment);
    if (!childMatch) {
      return null;
    }

    current = childMatch.node;
  }

  return current;
}

export function getDirectoryByPath(fileSystem, path) {
  const node = getNodeByPath(fileSystem, path);

  if (!node || node.type !== 'DIR') {
    return null;
  }

  return node;
}

export function listDirectory(fileSystem, path) {
  const directory = getDirectoryByPath(fileSystem, path);

  if (!directory) {
    return null;
  }

  return Object.keys(directory.children || {}).map((name) => ({
    name,
    node: directory.children[name],
  }));
}

export function readFileByPath(fileSystem, path) {
  const node = getNodeByPath(fileSystem, path);

  if (!node) {
    return { error: 'NOT_FOUND' };
  }

  if (node.type === 'DIR') {
    return { error: 'IS_DIRECTORY' };
  }

  return { node };
}

export function findByName(fileSystem, startPath, query, options = {}) {
  const recursive = Boolean(options.recursive);
  const directory = getDirectoryByPath(fileSystem, startPath);

  if (!directory) {
    return null;
  }

  const normalizedQuery = String(query ?? '').toUpperCase();
  const startSegments = getPathSegments(startPath);
  const matches = [];

  const visit = (node, pathSegments) => {
    const children = node.children || {};

    Object.keys(children).forEach((name) => {
      const child = children[name];
      const childPathSegments = [...pathSegments, name];

      if (name.toUpperCase().includes(normalizedQuery)) {
        matches.push({
          name,
          node: child,
          path: buildPathFromSegments(childPathSegments),
        });
      }

      if (recursive && child.type === 'DIR') {
        visit(child, childPathSegments);
      }
    });
  };

  visit(directory, startSegments);

  return matches;
}

export function inferFileType(name, node) {
  if (node && node.type && node.type !== 'FILE') {
    return String(node.type).toUpperCase();
  }

  const extensionIndex = String(name).lastIndexOf('.');
  if (extensionIndex === -1) {
    return 'FILE';
  }

  return String(name).slice(extensionIndex + 1).toUpperCase() || 'FILE';
}

export function inferFileSize(node) {
  if (!node) {
    return '0';
  }

  if (node.size !== undefined && node.size !== null) {
    return String(node.size);
  }

  if (typeof node.content === 'string') {
    return String(node.content.length);
  }

  return '0';
}
