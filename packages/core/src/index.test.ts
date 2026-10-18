import { describe, expect, it } from 'vitest';
import { Chart, version } from './index';

describe('@xila/core', () => {
  it('exporta la versión', () => {
    expect(typeof version).toBe('string');
  });

  it('exporta la clase Chart', () => {
    expect(typeof Chart).toBe('function');
  });
});
