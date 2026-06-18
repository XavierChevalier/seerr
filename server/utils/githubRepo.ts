import { readFileSync } from 'fs';
import path from 'path';

const DEFAULT_REPO = 'seerr-team/seerr';

export const getGithubRepo = (): string => {
  if (process.env.GITHUB_REPO) {
    return process.env.GITHUB_REPO;
  }

  try {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const { repository } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      repository?: { url?: string };
    };
    const url = repository?.url ?? '';

    const match = url.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
    return match?.[1] ?? DEFAULT_REPO;
  } catch {
    return DEFAULT_REPO;
  }
};
