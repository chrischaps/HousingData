/**
 * Market key: the one slug that names a market's split CSV file.
 *
 * The pipeline (scripts/split-csv.ts) uses it to decide what to call each
 * file it writes, and the app (csv.provider.ts) uses it to decide what URL to
 * fetch. If those two ever disagree, every market 404s, so both sides import
 * this module rather than carrying their own copy.
 *
 * Examples:
 *   marketKeyFromParts('New York', 'NY')  -> 'new-york-ny'
 *   marketKeyFromLocation('New York, NY') -> 'new-york-ny'
 *   marketKeyFromParts("Coeur d'Alene", 'ID') -> 'coeur-d-alene-id'
 */

/** Lower-case, collapse anything that isn't [a-z0-9] into single hyphens, trim. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Key from Zillow's RegionName + State columns. */
export function marketKeyFromParts(regionName: string, state: string): string {
  return slugify(`${regionName}-${state}`);
}

/** Key from a display location such as "New York, NY". */
export function marketKeyFromLocation(location: string): string {
  return slugify(location);
}
