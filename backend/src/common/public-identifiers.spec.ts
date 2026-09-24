import { BadRequestException } from '@nestjs/common';

import {
  formatPublicKey,
  parsePublicKey,
  PUBLIC_KEY_PREFIXES,
} from './public-identifiers';

describe('public identifiers', () => {
  it.each(Object.entries(PUBLIC_KEY_PREFIXES))(
    'formats and parses %s public keys with the %s prefix',
    (entity, prefix) => {
      expect(
        formatPublicKey(entity as keyof typeof PUBLIC_KEY_PREFIXES, 204),
      ).toBe(`${prefix}-204`);
      expect(
        parsePublicKey(
          entity as keyof typeof PUBLIC_KEY_PREFIXES,
          `${prefix}-204`,
        ),
      ).toBe(204);
    },
  );

  it.each([
    '20000000-0000-4000-8000-000000000002',
    'PRJ-0',
    'PRJ-01',
    'PRJ--1',
    'PRJ-1.5',
    'prj-1',
    'FEAT-1',
    'PRJ-2147483648',
    'not-a-public-key',
  ])('rejects invalid Project public key %s', (value) => {
    expect(() => parsePublicKey('project', value)).toThrow(BadRequestException);
  });

  it.each([0, -1, 1.5, 2_147_483_648])(
    'refuses to format invalid public number %s',
    (publicNumber) => {
      expect(() => formatPublicKey('project', publicNumber)).toThrow(
        RangeError,
      );
    },
  );
});
