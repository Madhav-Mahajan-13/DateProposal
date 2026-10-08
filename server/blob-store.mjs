import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

// One private JSON document, shared by every serverless instance.
export function createBlobResponseStore({
  validatePlan,
  pathname = process.env.BLOB_RESPONSES_PATH ||
    `biscuit/${process.env.VERCEL_ENV || 'development'}/responses.json`,
  client = { get, put },
} = {}) {
  async function read() {
    const result = await client.get(pathname, {
      access: 'private',
      useCache: false,
    });
    if (!result)
      return { document: { version: 1, responses: {} }, etag: undefined };
    if (result.statusCode !== 200 || !result.stream)
      throw new Error('Cannot read saved responses');
    const document = await new Response(result.stream).json();
    if (
      document?.version !== 1 ||
      !document.responses ||
      typeof document.responses !== 'object' ||
      Array.isArray(document.responses)
    )
      throw new Error('Invalid response store');
    for (const [id, response] of Object.entries(document.responses)) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ) ||
        typeof response?.updatedAt !== 'string'
      )
        throw new Error('Invalid saved response');
      validatePlan(response.plan);
    }
    if (!result.blob.etag) throw new Error('Missing storage version');
    return { document, etag: result.blob.etag };
  }

  async function update(change) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { document, etag } = await read();
      const value = change(document);
      try {
        await client.put(pathname, JSON.stringify(document, null, 2) + '\n', {
          access: 'private',
          addRandomSuffix: false,
          contentType: 'application/json',
          allowOverwrite: Boolean(etag),
          ...(etag ? { ifMatch: etag } : {}),
        });
        return value;
      } catch (error) {
        if (attempt === 4) throw error;
        if (error instanceof BlobPreconditionFailedError) continue;
        // The SDK exposes an existing-path error as a generic BlobError.
        // If another instance created the document, retry against its ETag.
        if (!etag && (await read()).etag) continue;
        throw error;
      }
    }
  }

  return {
    async get(id) {
      return (await read()).document.responses[id] ?? null;
    },
    async list() {
      return Object.values((await read()).document.responses).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
    },
    save(id, plan) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        )
      )
        throw new Error('Invalid visitor id');
      const cleanPlan = validatePlan(plan);
      return update((document) => {
        const response = {
          plan: cleanPlan,
          updatedAt: new Date().toISOString(),
        };
        document.responses[id] = response;
        return response;
      });
    },
    clear() {
      return update((document) => {
        document.responses = {};
      });
    },
  };
}
