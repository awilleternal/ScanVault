import { describe, it, expect } from '@jest/globals';
import { ODCBridge } from '../services/odcBridge.js';

describe('ODCBridge', () => {
  let odcBridge;

  beforeEach(() => {
    odcBridge = new ODCBridge();
  });

  describe('isAvailable', () => {
    it('should return boolean', async () => {
      const result = await odcBridge.isAvailable();
      expect(typeof result).toBe('boolean');
    });

    it('should return false on non-Windows platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });
      
      const result = await odcBridge.isAvailable();
      expect(result).toBe(false);
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });
  });

  describe('mapODCSeverity', () => {
    it('should map severity levels correctly', () => {
      expect(odcBridge.mapODCSeverity('CRITICAL')).toBe('CRITICAL');
      expect(odcBridge.mapODCSeverity('high')).toBe('HIGH');
      expect(odcBridge.mapODCSeverity('medium')).toBe('MEDIUM');
      expect(odcBridge.mapODCSeverity('low')).toBe('LOW');
      expect(odcBridge.mapODCSeverity('info')).toBe('LOW');
      expect(odcBridge.mapODCSeverity('')).toBe('LOW');
      expect(odcBridge.mapODCSeverity(null)).toBe('LOW');
      expect(odcBridge.mapODCSeverity('unknown')).toBe('LOW');
    });
  });

  describe('generateODCFix', () => {
    it('should generate appropriate fix suggestions', () => {
      const dependency = { fileName: 'lodash-4.17.11.jar' };
      const vuln = { name: 'CVE-2020-8203' };
      
      const fix = odcBridge.generateODCFix(dependency, vuln);
      expect(fix).toContain('lodash-4.17.11.jar');
      expect(fix).toContain('CVE-2020-8203');
      expect(fix).toContain('Update');
    });
  });
});
