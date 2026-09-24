import { BadRequestException, type PipeTransform } from '@nestjs/common';

export const PUBLIC_KEY_PREFIXES = {
  reviewReport: 'RPT',
  reviewFinding: 'FND',
  reportSource: 'SRC',
  reportAttachment: 'ATT',
  findingEvidence: 'EVD',
  feature: 'FEAT',
  findingReview: 'FREV',
  organization: 'ORG',
  project: 'PRJ',
  storageObject: 'OBJ',
  user: 'USR',
} as const;

export type PublicIdentifierEntity = keyof typeof PUBLIC_KEY_PREFIXES;
declare const PUBLIC_NUMBER_BRAND: unique symbol;
export type PublicNumber = number & {
  readonly [PUBLIC_NUMBER_BRAND]: 'PublicNumber';
};
export interface ParsedPublicNumber {
  readonly value: PublicNumber;
}

const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

export function formatPublicKey(
  entity: PublicIdentifierEntity,
  publicNumber: number,
): string {
  if (
    !Number.isInteger(publicNumber) ||
    publicNumber <= 0 ||
    publicNumber > POSTGRES_INTEGER_MAX
  ) {
    throw new RangeError(`Invalid ${entity} public number`);
  }

  return `${PUBLIC_KEY_PREFIXES[entity]}-${publicNumber}`;
}

export function parsePublicKey(
  entity: PublicIdentifierEntity,
  value: string,
): PublicNumber {
  const prefix = PUBLIC_KEY_PREFIXES[entity];
  const separatorIndex = value.indexOf('-');
  const suppliedPrefix = value.slice(0, separatorIndex);
  const numericPart = value.slice(separatorIndex + 1);

  if (
    separatorIndex !== prefix.length ||
    suppliedPrefix !== prefix ||
    !POSITIVE_INTEGER_PATTERN.test(numericPart)
  ) {
    throw new BadRequestException(`Invalid ${entity} public key`);
  }

  const publicNumber = Number(numericPart);

  if (publicNumber > POSTGRES_INTEGER_MAX) {
    throw new BadRequestException(`Invalid ${entity} public key`);
  }

  return publicNumber as PublicNumber;
}

export class ParsePublicKeyPipe implements PipeTransform<
  string,
  ParsedPublicNumber
> {
  constructor(private readonly entity: PublicIdentifierEntity) {}

  transform(value: string): ParsedPublicNumber {
    return {
      value: parsePublicKey(this.entity, value),
    };
  }
}
