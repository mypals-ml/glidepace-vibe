import { describe, expect, it } from 'vitest';
import {
  getGroupCardContentBg,
  getTreeColor,
} from './treeColors';

describe('tree color derivations', () => {
  it('renders the project group card content as 99% transparent', () => {
    expect(getGroupCardContentBg(0)).toBe(`color-mix(in srgb, ${getTreeColor(0)} 1%, transparent)`);
  });

  it('keeps nested group card content more visible than the project group', () => {
    expect(getGroupCardContentBg(1)).toBe(`color-mix(in srgb, ${getTreeColor(1)} 4%, transparent)`);
  });
});
