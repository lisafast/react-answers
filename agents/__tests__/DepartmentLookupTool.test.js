import { describe, it, expect, beforeEach, vi } from 'vitest';
import departmentLookup from '../tools/departmentLookupTool.js';


vi.mock('../../data/departments/departments_EN.js', () => ({
  departments_EN: [
    { name: 'Test Dept EN', abbr: 'TDE', url: 'https://www.test-dept-en.gc.ca' },
    { name: 'Canada EN', abbr: 'CAN', url: 'https://www.canada.ca/en' },
  ]
}));
vi.mock('../../data/departments/departments_FR.js', () => ({
  departments_FR: [
    { name: 'Test Dept FR', abbr: 'TDF', url: 'https://www.test-dept-fr.gc.ca' },
    { name: 'Canada FR', abbr: 'CANFR', url: 'https://www.canada.ca/fr' },
  ]
}));

describe('departmentLookupTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds a department by exact domain match (EN)', async () => {
    const url = 'https://www.test-dept-en.gc.ca';
    const result = await departmentLookup.invoke({ url });
    expect(JSON.parse(result)).toMatchObject({
      name: 'Test Dept EN',
      abbr: 'TDE',
      lang: 'en',
      url: 'https://www.test-dept-en.gc.ca',
    });
  });

  it('finds a department by exact domain match (FR)', async () => {
    const url = 'https://www.test-dept-fr.gc.ca';
    const result = await departmentLookup.invoke({ url });
    expect(JSON.parse(result)).toMatchObject({
      name: 'Test Dept FR',
      abbr: 'TDF',
      lang: 'fr',
      url: 'https://www.test-dept-fr.gc.ca',
    });
  });

  it('finds a department by canada.ca path match (EN)', async () => {
    const url = 'https://www.canada.ca/en/some/path';
    const result = await departmentLookup.invoke({ url });
    expect(JSON.parse(result)).toMatchObject({
      name: 'Canada EN',
      abbr: 'CAN',
      lang: 'en',
      url: 'https://www.canada.ca/en',
    });
  });

  it('finds a department by canada.ca path match (FR)', async () => {
    const url = 'https://www.canada.ca/fr/quelque-chose';
    const result = await departmentLookup.invoke({ url });
    expect(JSON.parse(result)).toMatchObject({
      name: 'Canada FR',
      abbr: 'CANFR',
      lang: 'fr',
      url: 'https://www.canada.ca/fr',
    });
  });

  it('returns not found for unknown department', async () => {
    const url = 'https://www.unknown-dept.gc.ca';
    const result = await departmentLookup.invoke({ url });
    expect(result).toMatch(/Department not found/);
  });

  it('trims trailing slashes and matches correctly', async () => {
    const url = 'https://www.test-dept-en.gc.ca/';
    const result = await departmentLookup.invoke({ url });
    expect(JSON.parse(result)).toMatchObject({
      name: 'Test Dept EN',
      abbr: 'TDE',
      lang: 'en',
      url: 'https://www.test-dept-en.gc.ca',
    });
  });

  it('handles invalid URLs gracefully', async () => {
    await expect(departmentLookup.invoke({ url: 'not-a-valid-url' })).rejects.toThrow();
  });
});
