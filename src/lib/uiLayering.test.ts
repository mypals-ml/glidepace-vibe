import { describe, expect, it } from 'vitest';
import { UI_LAYER } from './uiLayering';

describe('UI_LAYER', () => {
  it('keeps header dropdowns above the task details overlay', () => {
    const zIndex = (layer: string) => {
      const bracketMatch = layer.match(/z-\[(\d+)\]/);
      if (bracketMatch) return Number.parseInt(bracketMatch[1], 10);
      const plainMatch = layer.match(/z-(\d+)/);
      return plainMatch ? Number.parseInt(plainMatch[1], 10) : Number.NaN;
    };

    expect(zIndex(UI_LAYER.header)).toBeGreaterThan(zIndex(UI_LAYER.taskDetailsPanel));
    expect(zIndex(UI_LAYER.headerDropdown)).toBeGreaterThan(zIndex(UI_LAYER.header));
  });
});