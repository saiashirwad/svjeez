declare module "*.css" {
  const text: string;
  export default text;
}

/** The hashed file names build.ts gives app.js and worker.js, so a deploy never meets a stale copy in a browser cache. */
declare const APP_FILE: string;
declare const WORKER_FILE: string;
