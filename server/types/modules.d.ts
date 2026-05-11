declare module "*.js" {
  const content: any;
  export default content;
  export const setupTeachingSocket: any;
  export const httpRateLimiter: any;
  export const strictGuestLimiter: any;
  export const requestIdMiddleware: any;
  export const protect: any;
  export const optionalProtect: any;
  export const initPostgres: any;
  export const flushAnalytics: any;
}
