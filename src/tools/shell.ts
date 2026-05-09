import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCallback);

export interface RunCommandParams {
  command: string;
  cwd?: string;
}

export async function runCommand(params: RunCommandParams) {
  if (!params.command || typeof params.command !== 'string') {
    throw new Error('command must be a non-empty string.');
  }

  const cwd = params.cwd && typeof params.cwd === 'string' ? params.cwd : process.cwd();

  try {
    const { stdout, stderr } = await exec(params.command, { cwd, maxBuffer: 1024 * 1024 });

    return {
      success: true,
      command: params.command,
      cwd,
      stdout,
      stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      command: params.command,
      cwd,
      error: error?.message ?? String(error),
      stdout: error?.stdout ?? '',
      stderr: error?.stderr ?? '',
    };
  }
}

