// Where the published HCM example-problem fixtures live.
//
// Every suite here reads its expected inputs off disk from the sibling
// `transportations-library` checkout rather than transcribing them, so every
// suite needs to find it. Each one used to work that path out for itself, and
// each one got it wrong in the same place: the fallback was built by walking up
// from this repo's root, which is the workspace directory only when the repo is
// a plain clone. Inside a `git worktree` the root is wherever the worktree was
// added, usually a scratch directory with no siblings at all, so the fallback
// resolved to a path that has never existed and the failure surfaced as an
// `ENOENT` from deep inside `setInputFiles`. Three separate attempts to work in
// a worktree were spent on that message.
//
// So resolution is one function, in one file, and it knows about worktrees.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** The fixture tree's path below whichever `transportations-library` we find. */
const UNDER_LIB = ['tests', 'ExampleCases', 'hcm'];

const siblingOf = (repoRoot) => join(repoRoot, '..', 'transportations-library', ...UNDER_LIB);

/**
 * The checkout `git` considers the main one, which is the only place the
 * sibling library is ever cloned. `--git-common-dir` is shared by a repository
 * and all of its worktrees and points at the main checkout's `.git`, so its
 * parent is the main checkout. This is the whole worktree fix; everything else
 * in this file is the same two candidates the suites already used.
 *
 * Returns null rather than throwing when git is absent or this is not a
 * repository, because the CI clone is a repository but a tarball export is not
 * and both should still run.
 */
function mainWorkingTree() {
  try {
    const gitDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: here,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return gitDir ? dirname(gitDir) : null;
  } catch {
    return null;
  }
}

function resolveLibCases() {
  // An explicit override always wins, including over a path that exists, so a
  // run can be pointed at a second checkout without moving the first.
  if (process.env.HCM_LIB_CASES) return process.env.HCM_LIB_CASES;
  const main = mainWorkingTree();
  const candidates = [
    // A plain clone, and the layout CI builds: the library is cloned beside
    // this repo. Tried first so a normal checkout resolves without shelling
    // out to git at all.
    siblingOf(join(here, '..')),
    // A worktree of that clone. Dropped rather than defaulted when git is
    // absent, because `siblingOf('')` builds a RELATIVE path and `existsSync`
    // would then resolve it against the current directory and could match
    // something unrelated.
    ...(main ? [siblingOf(main)] : []),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  // Nothing found. Return the plain-clone candidate so the message a caller
  // prints names the place a reader is most likely to want to put the library.
  return candidates[0];
}

export const LIB_CASES = resolveLibCases();

/** Absolute path to one fixture, checked, because the alternative is an ENOENT
 * raised by whatever consumes the path several frames away from the cause. */
export function libCase(chapterDir, name) {
  const path = join(LIB_CASES, chapterDir, name);
  if (!existsSync(path)) {
    throw new Error(
      `HCM fixture ${chapterDir}/${name} not found at ${path}.\n` +
        `Clone transportations-library beside this repository, or set HCM_LIB_CASES to its tests/ExampleCases/hcm directory.`,
    );
  }
  return path;
}

export const readCase = (chapterDir, name) => JSON.parse(readFileSync(libCase(chapterDir, name), 'utf8'));
