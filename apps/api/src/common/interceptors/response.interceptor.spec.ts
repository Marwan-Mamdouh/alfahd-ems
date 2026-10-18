import { describe, it, expect } from 'vitest';
import { of, lastValueFrom } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor.js';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  const createMockContext = () => ({}) as any;
  const createMockHandler = (data: any) => ({
    handle: () => of(data),
  });

  it('wraps simple scalar or object into { data }', async () => {
    const handler = createMockHandler({ id: '123', name: 'AlFahd' });
    const result = await lastValueFrom(interceptor.intercept(createMockContext(), handler));
    expect(result).toEqual({ data: { id: '123', name: 'AlFahd' } });
  });

  it('wraps arrays into { data }', async () => {
    const handler = createMockHandler([1, 2, 3]);
    const result = await lastValueFrom(interceptor.intercept(createMockContext(), handler));
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('preserves top-level { data, meta } without double nesting for paginated responses', async () => {
    const paginated = {
      data: [{ id: 'emp-1' }, { id: 'emp-2' }],
      meta: { page: 1, pageSize: 20, total: 2 },
    };
    const handler = createMockHandler(paginated);
    const result = await lastValueFrom(interceptor.intercept(createMockContext(), handler));
    expect(result).toEqual(paginated);
    expect(result).not.toHaveProperty('data.data');
  });
});
