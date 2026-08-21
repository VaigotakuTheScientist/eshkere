#!/usr/bin/env node
/**
 * Offline checks for the Current-source validation rules. No network and no
 * token required — selectCurrentSource() is pure, so every failure mode the
 * deployment depends on can be exercised here.
 *
 *   node scripts/test-current-source.mjs
 */
import { selectCurrentSource, SyncError } from './fetch-current-source.mjs';

const failures = [];
const note = (ok, message) => {
  console.log(`${ok ? '  ok ' : 'FAIL '} ${message}`);
  if (!ok) failures.push(message);
};

const page = (title, url) => ({
  properties: {
    Source: { title: title === null ? [] : [{ plain_text: title }] },
    URL: { url },
  },
});

/** Assert that the given input is rejected, and report the message shown. */
const rejects = (label, run) => {
  try {
    run();
    note(false, `${label} — accepted, expected rejection`);
  } catch (error) {
    const expected = error instanceof SyncError;
    note(expected, `${label} — rejected: "${error.message}"`);
  }
};

// The one accepted shape.
{
  const source = selectCurrentSource([page('Deep Work', 'https://example.com/deep-work')]);
  note(
    source.title === 'Deep Work' && source.url === 'https://example.com/deep-work',
    `exactly one valid source accepted (${JSON.stringify(source)})`
  );
}

// Multi-part titles are joined, as Notion splits styled runs.
{
  const split = {
    properties: {
      Source: { title: [{ plain_text: 'Deep ' }, { plain_text: 'Work' }] },
      URL: { url: 'https://example.com/x' },
    },
  };
  note(selectCurrentSource([split]).title === 'Deep Work', 'split title runs are joined');
}

rejects('zero Current sources', () => selectCurrentSource([]));
rejects('undefined results', () => selectCurrentSource(undefined));
rejects('two Current sources', () =>
  selectCurrentSource([page('A', 'https://a.test'), page('B', 'https://b.test')])
);
rejects('one result but Notion reports more', () =>
  selectCurrentSource([page('A', 'https://a.test')], true)
);
rejects('empty URL', () => selectCurrentSource([page('A', '')]));
rejects('null URL', () => selectCurrentSource([page('A', null)]));
rejects('malformed URL', () => selectCurrentSource([page('A', 'not a url')]));
rejects('non-http scheme', () => selectCurrentSource([page('A', 'ftp://example.com/x')]));
rejects('javascript: scheme', () => selectCurrentSource([page('A', 'javascript:alert(1)')]));
rejects('empty title', () => selectCurrentSource([page(null, 'https://a.test')]));

console.log('\n————————————————————————————');
if (failures.length === 0) {
  console.log('All current-source checks passed.');
} else {
  console.log(`${failures.length} check(s) failed:`);
  for (const failure of failures) console.log(` - ${failure}`);
  process.exitCode = 1;
}
