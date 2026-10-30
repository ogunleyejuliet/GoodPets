// Good Pets - Pricing & Tier Calculation Module
// Single Source of Truth: PRD section 8.4, BR-001, BR-002, BR-003, BR-004

export type Species = 'DOG' | 'CAT';
export type ServiceType = 'GROOMING' | 'DAYCARE' | 'BOARDING';
export type GroomingPackage = 'BASIC' | 'FULL' | 'PREMIUM';
export type SizeTier = 'SMALL' | 'MEDIUM' | 'LARGE';

/**
 * BR-003: Dog size tier from weight in kg:
 * - under 10 kg is Small (e.g. 9.9 kg -> SMALL)
 * - 10 kg to 25 kg inclusive is Medium (e.g. 10.0 kg, 25.0 kg -> MEDIUM)
 * - over 25 kg is Large (e.g. 25.1 kg -> LARGE)
 * Cats have no size tier.
 */
export function calculateDogSizeTier(weightKg: number | null | undefined): SizeTier | null {
  if (weightKg === null || weightKg === undefined || isNaN(weightKg) || weightKg <= 0) {
    return null;
  }
  if (weightKg < 10.0) {
    return 'SMALL';
  }
  if (weightKg <= 25.0) {
    return 'MEDIUM';
  }
  return 'LARGE';
}

/**
 * Fixed price table (kobo) matching PRD 8.4:
 * ₦1 = 100 kobo
 */
export const PRICING_TABLE = {
  DAYCARE_PER_DAY_KOBO: 1200000, // ₦12,000
  BOARDING_PER_NIGHT_KOBO: 2500000, // ₦25,000
  GROOMING: {
    DOG: {
      SMALL: {
        BASIC: 1200000, // ₦12,000
        FULL: 2000000, // ₦20,000
        PREMIUM: 2500000, // ₦25,000
      },
      MEDIUM: {
        BASIC: 1600000, // ₦16,000
        FULL: 2700000, // ₦27,000
        PREMIUM: 3300000, // ₦33,000
      },
      LARGE: {
        BASIC: 2200000, // ₦22,000
        FULL: 3500000, // ₦35,000
        PREMIUM: 4200000, // ₦42,000
      },
    },
    CAT: {
      BASIC: 1500000, // ₦15,000
      FULL: 2200000, // ₦22,000
      // Cats cannot select Premium (FR-009)
    },
  },
} as const;

export interface PriceCalculationParams {
  serviceType: ServiceType;
  species: Species;
  weightKg?: number | null;
  groomingPackage?: GroomingPackage;
  quantity?: number;
  includeTax?: boolean;
}

export interface PriceCalculationResult {
  unitPriceKobo: number;
  quantity: number;
  subtotalKobo: number;
  taxKobo: number;
  taxRatePercent: number;
  totalKobo: number;
  totalWithTaxKobo: number;
  sizeTier: SizeTier | null;
  formattedUnitPrice: string;
  formattedSubtotal: string;
  formattedTax: string;
  formattedTotal: string;
  formattedTotalWithTax: string;
}

/**
 * Formats integer kobo into standard Nigerian Naira display string (₦X,XXX).
 */
export function formatNaira(amountKobo: number): string {
  const naira = Math.round(amountKobo / 100);
  return `₦${naira.toLocaleString('en-NG')}`;
}

/**
 * Calculates price per unit, subtotal, 2% tax, and total according to PRD section 8.4, BR-004, and Stage 3 requirements.
 */
export function calculatePrice(params: PriceCalculationParams): PriceCalculationResult {
  const { serviceType, species, weightKg, groomingPackage, quantity = 1, includeTax = false } = params;

  let unitPriceKobo = 0;
  let sizeTier: SizeTier | null = null;

  if (serviceType === 'DAYCARE') {
    unitPriceKobo = PRICING_TABLE.DAYCARE_PER_DAY_KOBO;
  } else if (serviceType === 'BOARDING') {
    unitPriceKobo = PRICING_TABLE.BOARDING_PER_NIGHT_KOBO;
  } else if (serviceType === 'GROOMING') {
    if (!groomingPackage) {
      throw new Error('Grooming package is required');
    }

    if (species === 'CAT') {
      if (groomingPackage === 'PREMIUM') {
        throw new Error('Premium Groom is not available for cats (FR-009)');
      }
      unitPriceKobo = PRICING_TABLE.GROOMING.CAT[groomingPackage];
    } else {
      // DOG
      sizeTier = calculateDogSizeTier(weightKg);
      if (!sizeTier) {
        throw new Error('Valid weight is required to calculate dog grooming price');
      }
      unitPriceKobo = PRICING_TABLE.GROOMING.DOG[sizeTier][groomingPackage];
    }
  } else {
    throw new Error(`Unsupported service type: ${serviceType}`);
  }

  const subtotalKobo = unitPriceKobo * quantity;
  const taxRatePercent = 2;
  const taxKobo = Math.round((subtotalKobo * taxRatePercent) / 100);
  const totalWithTaxKobo = subtotalKobo + taxKobo;
  const totalKobo = includeTax ? totalWithTaxKobo : subtotalKobo;

  return {
    unitPriceKobo,
    quantity,
    subtotalKobo,
    taxKobo,
    taxRatePercent,
    totalKobo,
    totalWithTaxKobo,
    sizeTier,
    formattedUnitPrice: formatNaira(unitPriceKobo),
    formattedSubtotal: formatNaira(subtotalKobo),
    formattedTax: formatNaira(taxKobo),
    formattedTotal: formatNaira(totalKobo),
    formattedTotalWithTax: formatNaira(totalWithTaxKobo),
  };
}

