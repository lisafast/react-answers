import { vi, describe, it, expect, beforeEach } from 'vitest';
import { departmentScenariosLogic } from '../tools/departmentScenariosTool.js';
import ServerLoggingService from '../../services/ServerLoggingService.js';

// Mock the dynamic imports assuming paths are relative to project root now
vi.mock('../../prompts/scenarios/context-specific/cra/cra-scenarios.js', () => ({
  CRA_SCENARIOS: 'Mock CRA Scenarios Content',
}));
vi.mock('../../prompts/scenarios/context-specific/esdc/esdc-scenarios.js', () => ({
  ESDC_SCENARIOS: 'Mock ESDC Scenarios Content',
}));
vi.mock('../../prompts/scenarios/context-specific/isc/isc-scenarios.js', () => ({
  ISC_SCENARIOS: 'Mock ISC Scenarios Content',
}));
vi.mock('../../prompts/scenarios/context-specific/psc/psc-scenarios.js', () => ({
  PSC_SCENARIOS: 'Mock PSC Scenarios Content',
}));
vi.mock('../../prompts/scenarios/context-specific/ircc/ircc-scenarios.js', () => ({
  IRCC_SCENARIOS: 'Mock IRCC Scenarios Content',
}));

// Mock logger using the pattern from db-persist-interaction.test.js
vi.mock('../../services/ServerLoggingService.js', () => ({
  default: { // Assuming ServerLoggingService is exported as default
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(), // Mock other used methods if necessary
    info: vi.fn(),
  }
}));

describe('departmentScenariosLogic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should load CRA scenarios for department CRA', async () => {
    const result = await departmentScenariosLogic({ department: 'CRA' });
    expect(result).toBe('Mock CRA Scenarios Content');
  });

  it('should load ESDC scenarios for department ESDC', async () => {
    const result = await departmentScenariosLogic({ department: 'ESDC' });
    expect(result).toBe('Mock ESDC Scenarios Content');
  });

  it('should load IRCC scenarios for department IRCC', async () => {
    const result = await departmentScenariosLogic({ department: 'IRCC' });
    expect(result).toBe('Mock IRCC Scenarios Content');
  });

  it('should load CRA scenarios for department ARC (French mapping)', async () => {
    const result = await departmentScenariosLogic({ department: 'ARC' });
    expect(result).toBe('Mock CRA Scenarios Content');
  });

  it('should load ESDC scenarios for department EDSC (French mapping)', async () => {
    const result = await departmentScenariosLogic({ department: 'EDSC' });
    expect(result).toBe('Mock ESDC Scenarios Content');
  });

  it('should return empty string for unknown department', async () => {
    const result = await departmentScenariosLogic({ department: 'UNKNOWN' });
    expect(result).toBe('');
  });

  it('should handle dynamic import errors gracefully', async () => {
    const modulePath = '../../prompts/scenarios/context-specific/cra/cra-scenarios.js';
    await vi.doMock(modulePath, () => {
      throw new Error('Simulated import error');
    });
    const { departmentScenariosLogic: logicWithError } = await import('../tools/departmentScenariosTool.js');
    const result = await logicWithError({ department: 'CRA' });
    expect(result).toBe('');
    expect(ServerLoggingService.error).toHaveBeenCalledWith(
      expect.stringContaining('Error loading scenarios module for department CRA'),
      null,
      expect.any(Error)
    );
    await vi.doUnmock(modulePath);
  });
});
