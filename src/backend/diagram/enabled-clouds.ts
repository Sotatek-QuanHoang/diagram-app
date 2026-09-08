/**
 * Which cloud icon sets this deployment will draw.
 *
 * Mirrors the `clouds.aws` / `clouds.azure` / `clouds.gcp` keys declared under
 * `config` in the manifest. Turning a provider off keeps its icons out of every
 * generated diagram, which in turn keeps that provider's glyph chunk out of the
 * browser — the UI only fetches a chunk when a scene references it.
 *
 * The value is read from the environment rather than from the invocation token:
 * the manifest declares the config surface, but the contract for delivering a
 * resolved per-installation value to app code is not part of the platform types
 * this app is built against. Resolution is deliberately confined to this module
 * so that switching to Core-delivered config is a change here and nowhere else.
 * Until then the setting is per-deployment, and the default admits everything —
 * an unset variable must never silently narrow what the app accepts.
 */

import type { CloudProvider } from './clouds.js';

const ALL: readonly CloudProvider[] = ['aws', 'azure', 'gcp'];

export const CLOUD_PROVIDERS_VAR = 'DIAGRAM_CLOUD_PROVIDERS';

function parse(raw: string | undefined): ReadonlySet<CloudProvider> {
  if (raw === undefined || raw.trim() === '') return new Set(ALL);

  const named = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '');

  const known = named.filter((entry): entry is CloudProvider =>
    (ALL as readonly string[]).includes(entry),
  );
  const unknown = named.filter((entry) => !(ALL as readonly string[]).includes(entry));
  if (unknown.length > 0) {
    // Loud, but not fatal: a typo should not take the service down, and the
    // providers that were spelled correctly still work.
    console.warn(JSON.stringify({
      event: 'unknown_cloud_provider_configured',
      variable: CLOUD_PROVIDERS_VAR,
      unknown,
      known: ALL,
    }));
  }

  // Naming only unknown providers would otherwise disable every cloud, which
  // reads as a broken app rather than a misconfigured one.
  return known.length > 0 ? new Set(known) : new Set(ALL);
}

let cached: ReadonlySet<CloudProvider> | undefined;

/** The enabled set, parsed once. */
export function enabledProviders(): ReadonlySet<CloudProvider> {
  cached ??= parse(process.env[CLOUD_PROVIDERS_VAR]);
  return cached;
}

/** Test seam: forget the parsed value so a changed environment is re-read. */
export function resetEnabledProviders(): void {
  cached = undefined;
}
