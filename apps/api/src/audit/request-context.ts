import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  userId?: string;
  userName?: string;
  ipAddress?: string;
}

/**
 * Carries the acting user through the call stack.
 *
 * The alternative is threading userId into every service method that might
 * write an audit entry, which changes a dozen signatures and is easy to forget
 * on the next one. AsyncLocalStorage keeps the context ambient and makes
 * "who did this" available wherever a mutation happens.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentActor(): RequestContext {
  return requestContext.getStore() ?? {};
}
