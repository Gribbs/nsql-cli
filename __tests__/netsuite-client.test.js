const { getSuiteQLEndpoint } = require('../lib/netsuite-client');

describe('netsuite-client', () => {
  describe('getSuiteQLEndpoint', () => {
    it('should return correct endpoint URL', () => {
      const endpoint = getSuiteQLEndpoint('TSTDRV1234567');
      expect(endpoint).toBe(
        'https://tstdrv1234567.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql'
      );
    });

    it('should normalize account ID with underscores', () => {
      const endpoint = getSuiteQLEndpoint('1234567_SB1');
      expect(endpoint).toContain('1234567-sb1');
    });

    it('should lowercase the account ID', () => {
      const endpoint = getSuiteQLEndpoint('TSTDRV1234567');
      expect(endpoint).toContain('tstdrv1234567');
    });
  });
});
