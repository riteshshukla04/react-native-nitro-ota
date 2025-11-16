export enum GitHubRefType {
  BRANCH = 'branch',
  TAG = 'tag',
}

export function parseGitHubUrl(githubUrl: string): {
  owner: string
  repo: string
} {
  const cleanUrl = githubUrl.replace(/\/$/, '').replace(/\.git$/, '')
  const parts = cleanUrl.split('/')

  if (parts.length < 5 || parts[2] !== 'github.com') {
    throw new Error(
      'Invalid GitHub URL format. Expected: https://github.com/owner/repo'
    )
  }

  return {
    owner: parts[3] as string,
    repo: parts[4] as string,
  }
}

export function createDownloadableGitHubUrl(
  githubUrl: string,
  ref: string = 'main',
  refType: GitHubRefType = GitHubRefType.BRANCH
): string {
  // Extract owner and repo from GitHub URL

  const { owner, repo } = parseGitHubUrl(githubUrl)

  const refPath = refType === GitHubRefType.BRANCH ? 'heads' : 'tags'

  return `https://github.com/${owner}/${repo}/archive/refs/${refPath}/${ref}.zip`
}

export interface GitHubFileOptions {
  githubUrl: string
  path: string
  ref?: string // branch, tag, or commit SHA
}

export function getVersionUrl(options: GitHubFileOptions): string {
  const { githubUrl, path, ref = 'main' } = options

  // Extract owner and repo from GitHub URL
  const { owner, repo } = parseGitHubUrl(githubUrl)

  // GitHub raw content URL format
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`
  return url
}

export function githubOTA({
  githubUrl,
  otaVersionPath = 'ota.version',
  ref = 'main',
}: {
  githubUrl: string
  otaVersionPath?: string
  ref?: string
}): {
  downloadUrl: string
  versionUrl: string
} {
  const downloadUrl = createDownloadableGitHubUrl(
    githubUrl,
    ref,
    GitHubRefType.BRANCH
  )
  const versionUrl = getVersionUrl({ githubUrl, path: otaVersionPath, ref })
  return { downloadUrl, versionUrl }
}
