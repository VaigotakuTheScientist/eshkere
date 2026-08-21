#!/usr/bin/env node
/**
 * Sync the current reading source from the private Notion "Sources" data
 * source into src/data/current-source.generated.json, which the hero's
 * shining-star hotspot reads at build time.
 *
 *   NOTION_TOKEN=… node scripts/fetch-current-source.mjs
 *
 * Only the selected title and URL ever leave Notion. This repository is
 * public, so nothing else — no page contents, no other rows, no API
 * responses, no token — may reach the generated file or the CI log.
 *
 * The script exits non-zero on any problem so a failed sync stops the
 * deployment and leaves the previously published site untouched.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** The private Sources data source. Not a secret: it is useless without the token. */
export const DATA_SOURCE_ID = '84c46ccd-a531-40be-9ac2-6ba3a5208b7f';

export const OUTPUT_PATH = fileURLToPath(
  new URL('../src/data/current-source.generated.json', import.meta.url)
);

/** Signals an expected, reportable problem — message is safe to print. */
export class SyncError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SyncError';
  }
}

/**
 * Validate the query result and extract the publishable fields.
 *
 * Exported separately from the network call so every failure mode can be
 * exercised offline (see scripts/test-current-source.mjs).
 *
 * @param {unknown[]} results Pages returned by the Current filter.
 * @param {boolean} hasMore Whether Notion reported further matches.
 * @returns {{ title: string, url: string }}
 */
export function selectCurrentSource(results, hasMore = false) {
  const pages = Array.isArray(results) ? results : [];

  if (pages.length === 0) {
    throw new SyncError(
      'No source has Current checked. Check Current on exactly one Source with a valid URL.'
    );
  }
  if (pages.length > 1 || hasMore) {
    throw new SyncError(
      `More than one source has Current checked (found at least ${pages.length + (hasMore ? 1 : 0)}). Exactly one is required.`
    );
  }

  const properties = pages[0]?.properties ?? {};

  const title = (properties.Source?.title ?? [])
    .map((part) => part?.plain_text ?? '')
    .join('')
    .trim();
  if (!title) {
    throw new SyncError('The current source has an empty Source title.');
  }

  const rawUrl = typeof properties.URL?.url === 'string' ? properties.URL.url.trim() : '';
  if (!rawUrl) {
    throw new SyncError('The current source has an empty URL.');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SyncError('The current source URL is not a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SyncError(
      `The current source URL must use http or https (found "${parsed.protocol.replace(':', '')}").`
    );
  }

  return { title, url: parsed.toString() };
}

async function main() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new SyncError(
      'NOTION_TOKEN is not set. Add it as an Actions secret (see the README).'
    );
  }

  const { Client } = await import('@notionhq/client');
  const notion = new Client({
    auth: token,
    // Silence the SDK's own logger: this runs in a public Actions log, and
    // failures are reported by error code below instead.
    logger: () => {},
  });

  let response;
  try {
    response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      filter: { property: 'Current', checkbox: { equals: true } },
      // Two is enough to tell "exactly one" from "more than one".
      page_size: 2,
    });
  } catch (error) {
    // Report only the error code: bodies can echo request context.
    throw new SyncError(`Notion query failed (${error?.code ?? error?.name ?? 'unknown error'}).`);
  }

  const source = selectCurrentSource(response?.results, response?.has_more);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(source, null, 2)}\n`);

  // The title is about to be published on the site, so it is safe to echo.
  console.log(`Current source synced: ${source.title}`);
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error) => {
    const message = error instanceof SyncError ? error.message : 'Unexpected failure during sync.';
    console.error(`current-source sync failed: ${message}`);
    process.exitCode = 1;
  });
}
