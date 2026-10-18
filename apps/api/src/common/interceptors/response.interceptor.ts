import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseShape<T> {
  data: T;
  meta?: unknown;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'data' in payload &&
          'meta' in payload
        ) {
          return payload;
        }
        return { data: payload };
      }),
    );
  }
}
