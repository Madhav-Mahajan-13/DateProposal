import type { IncomingMessage, ServerResponse } from 'node:http';

export function createResponseApi(options?: {
  filePath?: string;
}): (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void | Promise<void>;
