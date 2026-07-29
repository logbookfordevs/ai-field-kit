import { managedMarker, normalizeManagedRelativePath } from "./fs-utils.js";

export type RulesFileDestinationValidation = {
  valid: true;
  normalized: string[];
  errors: [];
} | {
  valid: false;
  normalized: Array<string | null>;
  errors: string[];
};

export function validateRulesFileDestinations(destinations: string[]): RulesFileDestinationValidation {
  const normalized: Array<string | null> = [];
  const validNormalized: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const input of destinations) {
    const destination = normalizeManagedRelativePath(input);
    normalized.push(destination);
    if (!destination || destination === managedMarker) {
      errors.push(`Invalid rules file destination: ${input}`);
      continue;
    }
    if (seen.has(destination)) {
      errors.push(`Duplicate rules file destination: ${destination}`);
      continue;
    }
    seen.add(destination);
    validNormalized.push(destination);
  }

  return errors.length > 0
    ? { valid: false, normalized, errors }
    : { valid: true, normalized: validNormalized, errors: [] };
}
