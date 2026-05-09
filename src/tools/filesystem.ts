import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface WriteFileParams {
  path: string;
  content: string;
}

export interface ReadFileParams {
  path: string;
  encoding?: BufferEncoding;
}

export interface ListDirectoryParams {
  path: string;
}

export async function writeFile(params: WriteFileParams) {
  const resolvedPath = resolvePath(params.path);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, params.content, 'utf8');

  return {
    success: true,
    path: resolvedPath,
    bytesWritten: Buffer.byteLength(params.content, 'utf8'),
  };
}

export async function readFile(params: ReadFileParams) {
  const resolvedPath = resolvePath(params.path);
  const encoding: BufferEncoding = params.encoding ?? 'utf8';
  const content = await fs.readFile(resolvedPath, { encoding });

  return {
    success: true,
    path: resolvedPath,
    content,
  };
}

export async function listDirectory(params: ListDirectoryParams) {
  const resolvedPath = resolvePath(params.path);
  const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

  return {
    success: true,
    path: resolvedPath,
    entries: entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    })),
  };
}

function resolvePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Path must be a non-empty string.');
  }

  if (inputPath.startsWith('~')) {
    const home = process.env.HOME ?? '';
    return path.resolve(home, inputPath.slice(1));
  }

  return path.resolve(inputPath);
}

