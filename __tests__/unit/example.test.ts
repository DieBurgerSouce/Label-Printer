/**
 * Example Unit Test - Screenshot_Algo
 * Template for creating unit tests
 */

describe('Example Unit Tests', () => {
  describe('Math operations', () => {
    it('should add numbers correctly', () => {
      expect(1 + 1).toBe(2);
    });

    it('should multiply numbers correctly', () => {
      expect(2 * 3).toBe(6);
    });
  });

  describe('String operations', () => {
    it('should concatenate strings', () => {
      const result = 'Hello' + ' ' + 'World';
      expect(result).toBe('Hello World');
    });

    it('should convert to uppercase', () => {
      expect('test'.toUpperCase()).toBe('TEST');
    });
  });

  describe('Array operations', () => {
    it('should filter array elements', () => {
      const numbers = [1, 2, 3, 4, 5];
      const evenNumbers = numbers.filter(n => n % 2 === 0);
      expect(evenNumbers).toEqual([2, 4]);
    });

    it('should map array elements', () => {
      const numbers = [1, 2, 3];
      const doubled = numbers.map(n => n * 2);
      expect(doubled).toEqual([2, 4, 6]);
    });
  });

  describe('Async operations', () => {
    it('should resolve promise', async () => {
      const promise = Promise.resolve('success');
      await expect(promise).resolves.toBe('success');
    });

    it('should reject promise', async () => {
      const promise = Promise.reject(new Error('failure'));
      await expect(promise).rejects.toThrow('failure');
    });
  });
});
