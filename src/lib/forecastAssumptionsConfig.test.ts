import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORECAST_ASSUMPTIONS,
  FORECAST_ASSUMPTIONS_CONFIG_MARKER,
  FORECAST_ASSUMPTIONS_CONFIG_VERSION,
  buildForecastAssumptionsConfigBlock,
  embedForecastAssumptionsInReadme,
  normalizeForecastAssumptions,
  parseForecastAssumptionsFromReadme,
  toStoredForecastAssumptionsPayload,
  upgradeForecastAssumptionsPayload,
} from './forecastAssumptionsConfig';

describe('forecastAssumptionsConfig', () => {
  it('serializes assumptions under settings.assumptions with the current version', () => {
    expect(toStoredForecastAssumptionsPayload(DEFAULT_FORECAST_ASSUMPTIONS)).toEqual({
      version: FORECAST_ASSUMPTIONS_CONFIG_VERSION,
      settings: {
        assumptions: DEFAULT_FORECAST_ASSUMPTIONS,
      },
    });
  });

  it('parses forecast assumptions from a project readme block', () => {
    const readme = [
      '# Team planning notes',
      '',
      buildForecastAssumptionsConfigBlock({
        capacityDaysPerWeek: 4,
        statusRemainingPercent: {
          draft: 0,
          todo: 90,
          inProgress: 40,
          inReview: 15,
          done: 0,
          other: 25,
        },
      }),
    ].join('\n');

    expect(parseForecastAssumptionsFromReadme(readme)).toEqual({
      assumptions: {
        capacityDaysPerWeek: 4,
        statusRemainingPercent: {
          draft: 0,
          todo: 90,
          inProgress: 40,
          inReview: 15,
          done: 0,
          other: 25,
        },
      },
      upgradedFromVersion: null,
    });
  });

  it('upgrades legacy flat payloads without a version field to the nested schema', () => {
    const legacyPayload = {
      capacityDaysPerWeek: 4,
      availableWorkers: 3,
      statusRemainingPercent: {
        draft: 0,
        todo: 90,
        inProgress: 40,
        inReview: 15,
        done: 0,
        other: 25,
      },
    };

    expect(upgradeForecastAssumptionsPayload(legacyPayload)).toEqual({
      assumptions: {
        capacityDaysPerWeek: 4,
        availableWorkers: 3,
        statusRemainingPercent: {
          draft: 0,
          todo: 90,
          inProgress: 40,
          inReview: 15,
          done: 0,
          other: 25,
        },
      },
      upgradedFromVersion: 0,
    });
  });

  it('upgrades version 1 flat payloads into settings.assumptions at version 2', () => {
    const versionOnePayload = {
      version: 1,
      capacityDaysPerWeek: 6,
      statusRemainingPercent: DEFAULT_FORECAST_ASSUMPTIONS.statusRemainingPercent,
    };

    expect(upgradeForecastAssumptionsPayload(versionOnePayload)).toEqual({
      assumptions: {
        capacityDaysPerWeek: 6,
        statusRemainingPercent: DEFAULT_FORECAST_ASSUMPTIONS.statusRemainingPercent,
      },
      upgradedFromVersion: 1,
    });
  });

  it('still parses legacy readme markers and upgrades them to the current marker and version', () => {
    const legacyReadme = [
      '# Notes',
      '<!-- glidelines-config:forecast:v1 -->',
      JSON.stringify({
        capacityDaysPerWeek: 6,
        statusRemainingPercent: DEFAULT_FORECAST_ASSUMPTIONS.statusRemainingPercent,
      }),
      '<!-- /glidelines-config:forecast:v1 -->',
    ].join('\n');

    const parsed = parseForecastAssumptionsFromReadme(legacyReadme);
    expect(parsed?.assumptions.capacityDaysPerWeek).toBe(6);
    expect(parsed?.upgradedFromVersion).toBe(0);

    const upgraded = embedForecastAssumptionsInReadme(legacyReadme, parsed!.assumptions);
    expect(upgraded).toContain(`<!-- ${FORECAST_ASSUMPTIONS_CONFIG_MARKER} -->`);
    expect(upgraded).not.toContain('glidelines-config:forecast:v1');
    expect(upgraded).toContain(`"version":${FORECAST_ASSUMPTIONS_CONFIG_VERSION}`);
    expect(upgraded).toContain('"settings"');
    expect(upgraded).toContain('"assumptions"');
  });

  it('replaces an existing config block when embedding', () => {
    const initial = embedForecastAssumptionsInReadme('# Notes', DEFAULT_FORECAST_ASSUMPTIONS);
    const updated = embedForecastAssumptionsInReadme(initial, {
      ...DEFAULT_FORECAST_ASSUMPTIONS,
      capacityDaysPerWeek: 6,
    });

    expect(updated.match(new RegExp(FORECAST_ASSUMPTIONS_CONFIG_MARKER, 'g'))?.length).toBe(2);
    expect(parseForecastAssumptionsFromReadme(updated)?.assumptions.capacityDaysPerWeek).toBe(6);
    expect(updated.startsWith('# Notes')).toBe(true);
  });

  it('normalizes invalid values to safe defaults', () => {
    expect(normalizeForecastAssumptions({
      capacityDaysPerWeek: -2,
      statusRemainingPercent: {
        draft: -5,
        todo: 120,
        inProgress: 50,
        inReview: 20,
        done: 0,
        other: 50,
      },
    })).toEqual(DEFAULT_FORECAST_ASSUMPTIONS);
  });
});
