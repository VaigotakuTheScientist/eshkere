export const cadences = ['morning', 'evening', 'periodic', 'as-needed'] as const;
export type Cadence = (typeof cadences)[number];
export type ModuleId = 'hair' | 'nails' | 'face';

export const sources = {
  hair: ['AAD · Healthy hair tips', 'https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips'],
  styling: ['AAD · Hairstyle tension', 'https://www.aad.org/public/diseases/hair-loss/causes/hairstyles'],
  nails: ['AAD · Healthy nail tips', 'https://www.aad.org/public/everyday-care/nail-care-secrets/basics/healthy-nail-tips'],
  manicure: ['AAD · Manicure safety', 'https://www.aad.org/public/everyday-care/nail-care-secrets/basics/pedicures/manicure-pedicure-safety'],
  face: ['AAD · Face washing', 'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101'],
  skin: ['AAD · Everyday skin care', 'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/healthier-looking-skin'],
  sun: ['AAD · Applying sunscreen', 'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen'],
} as const;

export interface Step<SupplyId extends string = string> {
  id: string;
  title: string;
  action: string;
  kind: 'core' | 'optional' | 'conditional';
  why: string;
  basis: 'guidance' | 'preference';
  supplies?: readonly SupplyId[];
  precaution?: string;
  source?: keyof typeof sources;
}

export interface Routine<SupplyId extends string = string> {
  id: Cadence;
  timing: string;
  steps: readonly Step<SupplyId>[];
}

export interface Supply {
  id: string;
  title: string;
  kind: 'Product' | 'Equipment';
}

export interface CareModule<SupplyId extends string = string> {
  id: ModuleId;
  title: string;
  subtitle: string;
  routines: readonly Routine<SupplyId>[];
  inventory: readonly (Supply & { id: SupplyId })[];
  experiment: {
    id: string;
    title: string;
    hypothesis: string;
    variable: string;
    prompt: string;
    stop: string;
  };
  escalation: string;
}

/** Qualify step and supply IDs so modules can evolve independently. */
export function preferenceId(moduleId: ModuleId, id: string): string {
  return `${moduleId}/${id}`;
}
