import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle strings', () => {
    const greeting = 'Hello, World!';
    expect(greeting).toContain('World');
  });

  it('should handle objects', () => {
    const user = { name: 'John', age: 30 };
    expect(user).toEqual({ name: 'John', age: 30 });
  });
});
