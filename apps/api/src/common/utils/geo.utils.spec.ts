import { describe, it, expect } from 'vitest';
import { haversineDistanceMeters } from './geo.utils.js';

describe('haversineDistanceMeters', () => {
  const CAIRO_CITADEL = { lat: 30.0299, lng: 31.2611 };
  const TAHRIR_SQUARE = { lat: 30.0444, lng: 31.2357 };

  it('calculates 0 meters for identical coordinates', () => {
    const dist = haversineDistanceMeters(
      CAIRO_CITADEL.lat,
      CAIRO_CITADEL.lng,
      CAIRO_CITADEL.lat,
      CAIRO_CITADEL.lng,
    );
    expect(dist).toBe(0);
  });

  it('calculates distance between known landmarks in Cairo (~2950m)', () => {
    const dist = haversineDistanceMeters(
      CAIRO_CITADEL.lat,
      CAIRO_CITADEL.lng,
      TAHRIR_SQUARE.lat,
      TAHRIR_SQUARE.lng,
    );
    expect(dist).toBeGreaterThan(2900);
    expect(dist).toBeLessThan(3000);
  });

  it('accurately measures exact distance increments (0m, 149m, 150m, 151m)', () => {
    const baseLat = 30.0444;
    const baseLng = 31.2357;
    const toDeg = 180 / (Math.PI * 6371000);

    const lat149 = baseLat + 149 * toDeg;
    const lat150 = baseLat + 150 * toDeg;
    const lat151 = baseLat + 151 * toDeg;

    const d0 = haversineDistanceMeters(baseLat, baseLng, baseLat, baseLng);
    const d149 = haversineDistanceMeters(baseLat, baseLng, lat149, baseLng);
    const d150 = haversineDistanceMeters(baseLat, baseLng, lat150, baseLng);
    const d151 = haversineDistanceMeters(baseLat, baseLng, lat151, baseLng);

    expect(Math.round(d0)).toBe(0);
    expect(Math.round(d149)).toBe(149);
    expect(Math.round(d150)).toBe(150);
    expect(Math.round(d151)).toBe(151);

    expect(d149).toBeLessThanOrEqual(150);
    expect(d150).toBeLessThanOrEqual(150.0001);
    expect(d151).toBeGreaterThan(150);
  });
});
