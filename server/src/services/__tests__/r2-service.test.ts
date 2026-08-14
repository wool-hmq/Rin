import { describe, it, expect } from 'bun:test';
import { R2Service } from '../r2-service';
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Variables } from "../../core/hono-types";
import { createMockEnv } from '../../../tests/fixtures';

function createR2App(r2Env: Env, uid?: number) {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use(createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
        c.set('env', r2Env);
        c.set('uid', uid);
        await next();
    }));
    app.route('/r2', R2Service());
    return app;
}

function createR2BucketMock(overrides?: Partial<R2Bucket>): R2Bucket {
    return {
        get: async () => null,
        put: async () => {
            throw new Error('unexpected put');
        },
        delete: async () => {},
        list: async () => ({ objects: [], delimitedPrefixes: [], truncated: false }),
        ...overrides,
    } as unknown as R2Bucket;
}

function createR2ObjectBody(content: string, contentType = 'text/plain'): R2ObjectBody {
    return {
        key: 'data.json',
        size: content.length,
        etag: 'etag',
        httpEtag: 'etag',
        uploaded: new Date('2025-01-01T00:00:00Z'),
        storageClass: 'Standard',
        checksums: {} as R2Checksums,
        httpMetadata: { contentType },
        writeHttpMetadata(headers: Headers) {
            headers.set('Content-Type', contentType);
        },
        body: new Blob([content]).stream(),
        bodyUsed: false,
        arrayBuffer: async () => new TextEncoder().encode(content).buffer,
        text: async () => content,
        json: async () => JSON.parse(content),
        blob: async () => new Blob([content]),
        bytes: async () => new Uint8Array(new TextEncoder().encode(content)),
    } as unknown as R2ObjectBody;
}

describe('R2Service', () => {
    it('GET /r2/:key should require authentication', async () => {
        const r2Env = createMockEnv({
            R2_BUCKET: createR2BucketMock(),
        });
        const app = createR2App(r2Env);

        const res = await app.request('/r2/data.json', { method: 'GET' }, r2Env);
        expect(res.status).toBe(401);
    });

    it('GET /r2/:key should return file content', async () => {
        const r2Env = createMockEnv({
            R2_BUCKET: createR2BucketMock({
                get: async (key: string) => {
                    if (key !== 'data.json') return null;
                    return createR2ObjectBody('{"hello":"world"}', 'application/json');
                },
            }),
        });
        const app = createR2App(r2Env, 1);

        const res = await app.request('/r2/data.json', { method: 'GET' }, r2Env);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('{"hello":"world"}');
    });

    it('GET /r2/:key?download=1 should set Content-Disposition', async () => {
        const r2Env = createMockEnv({
            R2_BUCKET: createR2BucketMock({
                get: async () => createR2ObjectBody('test content'),
            }),
        });
        const app = createR2App(r2Env, 1);

        const res = await app.request('/r2/data.json?download=1', { method: 'GET' }, r2Env);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-disposition')).toBe('attachment; filename="data.json"');
    });

    it('GET /r2/:key should return 404 when object does not exist', async () => {
        const r2Env = createMockEnv({
            R2_BUCKET: createR2BucketMock({
                get: async () => null,
            }),
        });
        const app = createR2App(r2Env, 1);

        const res = await app.request('/r2/missing.txt', { method: 'GET' }, r2Env);
        expect(res.status).toBe(404);
    });

    it('PUT /r2/:key should require authentication', async () => {
        const r2Env = createMockEnv({
            R2_BUCKET: createR2BucketMock(),
        });
        const app = createR2App(r2Env);

        const res = await app.request('/r2/data.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            body: '{}',
        }, r2Env);
        expect(res.status).toBe(401);
    });

    it('PUT /r2/:key should save text content', async () => {
        const putCalls: Array<{ key: string; body: string; contentType: string | undefined }> = [];
        const r2Env = createMockEnv({
            R2_BUCKET: createR2BucketMock({
                put: async (key: string, value: any, options?: R2PutOptions) => {
                    putCalls.push({
                        key,
                        body: value as string,
                        contentType: options?.httpMetadata && 'contentType' in options.httpMetadata
                            ? options.httpMetadata.contentType
                            : undefined,
                    });
                    return {
                        key,
                        version: '1',
                        size: 4,
                        etag: 'etag',
                        httpEtag: 'etag',
                        uploaded: new Date(),
                        storageClass: 'Standard',
                        checksums: {} as R2Checksums,
                        writeHttpMetadata: () => {},
                    } as unknown as R2Object;
                },
            }),
        });
        const app = createR2App(r2Env, 1);

        const res = await app.request('/r2/data.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            body: '{"a":1}',
        }, r2Env);

        expect(res.status).toBe(200);
        expect(putCalls).toHaveLength(1);
        expect(putCalls[0]?.key).toBe('data.json');
        expect(putCalls[0]?.body).toBe('{"a":1}');
        expect(putCalls[0]?.contentType).toBe('application/json;charset=UTF-8');
        const payload = await res.json() as { success: boolean; key: string };
        expect(payload.success).toBe(true);
    });

    it('PUT /r2/:key should reject non-editable file types', async () => {
        const r2Env = createMockEnv({
            R2_BUCKET: createR2BucketMock(),
        });
        const app = createR2App(r2Env, 1);

        const res = await app.request('/r2/photo.png', {
            method: 'PUT',
            headers: { 'Content-Type': 'image/png' },
            body: 'binary',
        }, r2Env);
        expect(res.status).toBe(400);
        expect(await res.text()).toBe('File type is not editable');
    });
});
