const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const headings = /^#{1,2} \[([0-9.]+)\](?:\(([^)\n]+)\))? \(\d{4}-\d{2}-\d{2}\)$/gm;
const unreleasedHeading = '## [Unreleased]';

/** Read the shared version and split the working notes from release history. */
function readRelease() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');
  const [prefix, history, ...rest] = changelog.split(/^## \[Unreleased\]$/m);
  const releases = history ? [...history.matchAll(headings)] : [];
  const latest = releases[0];
  const version = manifest.version;

  if (!versionPattern.test(version) || lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error('package.json and both package-lock.json versions must match a MAJOR.MINOR.PATCH version.');
  }
  if (!latest || rest.length || !/^# Changelog\s*$/.test(prefix)) {
    throw new Error('CHANGELOG.md must start with # Changelog, one ## [Unreleased] heading, and release history below it.');
  }
  if (latest[1] !== version || releases.filter((release) => release[1] === version).length !== 1) {
    throw new Error(`The newest changelog entry must be the only entry for package version ${version}.`);
  }

  const pending = history.slice(0, latest.index).trim();
  const latestBody = history.slice(latest.index + latest[0].length, releases[1]?.index).trim();
  return { version, pending, latestBody, latestLink: latest[2], history: history.slice(latest.index) };
}

/** Compare numeric SemVer components without changing the chosen version. */
function isNewer(candidate, current) {
  const components = candidate.split('.').map(BigInt);
  const previous = current.split('.').map(BigInt);
  const difference = components.findIndex((part, index) => part !== previous[index]);
  return difference !== -1 && components[difference] > previous[difference];
}

/** Freeze the pending notes and bump npm's version metadata without making a commit or tag. */
function prepare(release, nextVersion) {
  if (!versionPattern.test(nextVersion) || !isNewer(nextVersion, release.version)) {
    throw new Error(`Choose a MAJOR.MINOR.PATCH version newer than ${release.version}.`);
  }
  if (!/^[-*] \S/m.test(release.pending)) {
    throw new Error('Add at least one release note under Unreleased before preparing a release.');
  }
  if ([...release.history.matchAll(headings)].some((entry) => entry[1] === nextVersion)) {
    throw new Error(`CHANGELOG.md already contains ${nextVersion}.`);
  }

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const compare = `https://github.com/ryanraposo/gyroclopter/compare/v${release.version}...v${nextVersion}`;
  const heading = `## [${nextVersion}](${compare}) (${date})`;
  const changelog = `# Changelog\n\n${unreleasedHeading}\n\n${heading}\n\n${release.pending}\n\n${release.history}`;

  // Update the three files consistently without rewriting the dependency graph.
  const versionField = `"version": "${release.version}"`;
  const nextField = `"version": "${nextVersion}"`;
  const manifestPath = path.join(root, 'package.json');
  const lockPath = path.join(root, 'package-lock.json');
  const manifest = fs.readFileSync(manifestPath, 'utf8').replace(versionField, nextField);
  const lock = fs.readFileSync(lockPath, 'utf8')
    .replace(`\n  ${versionField}`, `\n  ${nextField}`)
    .replace(`\n      ${versionField}`, `\n      ${nextField}`);
  const changedLock = JSON.parse(lock);
  if (JSON.parse(manifest).version !== nextVersion || changedLock.version !== nextVersion ||
      changedLock.packages?.['']?.version !== nextVersion) {
    throw new Error('Could not update the version fields. Check the package file formatting.');
  }
  fs.writeFileSync(manifestPath, manifest);
  fs.writeFileSync(lockPath, lock);
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), changelog);
  console.log(`Prepared v${nextVersion}. Review and commit CHANGELOG.md, package.json, and package-lock.json.`);
}

/** Print the exact Markdown that GitHub will show for the current release. */
function printNotes(release, tag) {
  if (tag !== `v${release.version}`) {
    throw new Error(`Expected tag v${release.version}, received ${tag || '(missing)'}.`);
  }
  if (release.pending || !/^[-*] \S/m.test(release.latestBody)) {
    throw new Error('A release commit needs a populated version entry and an empty Unreleased section.');
  }
  console.log(release.latestBody);
  if (release.latestLink) console.log(`\n[Full changelog](${release.latestLink})`);
}

const [, , command, argument, ...extras] = process.argv;
try {
  if (extras.length || (argument && ['check', 'preview'].includes(command))) {
    throw new Error('Usage: release.js check | preview | prepare <version> | notes <tag>');
  }
  const release = readRelease();
  switch (command) {
    case 'check':
      console.log(`Release metadata agrees on v${release.version}.`);
      break;
    case 'preview':
      console.log(release.pending || 'No unreleased changes recorded.');
      break;
    case 'prepare':
      prepare(release, argument);
      break;
    case 'notes':
      printNotes(release, argument);
      break;
    default:
      throw new Error('Usage: release.js check | preview | prepare <version> | notes <tag>');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
