import test from 'node:test';
import assert from 'node:assert/strict';

test('listProjects requests paginated data and maps pagination fields', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });

    return new Response(
      JSON.stringify({
        code: 200,
        message: 'success',
        data: {
          items: [
            {
              id: 'project-1',
              name: 'Project 1',
              created_at: 1,
              updated_at: 2,
            },
          ],
          pagination: {
            page: 2,
            page_size: 10,
            total: 23,
            total_pages: 3,
          },
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const { listProjects } = await import('@/lib/project-api');
    const result = await listProjects({ page: 2, page_size: 10 });

    assert.equal(calls.length, 1);
    assert.equal((calls[0].init?.method ?? 'GET').toUpperCase(), 'GET');

    const url = String(calls[0].input);
    assert.match(url, /\/api\/v1\/admin\/projects/);
    assert.match(url, /page=2/);
    assert.match(url, /page_size=10/);
    assert.match(url, /sort_by=updated_at/);
    assert.match(url, /order=desc/);

    assert.deepEqual(result, {
      items: [
        {
          id: 'project-1',
          title: 'Project 1',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      pagination: {
        page: 2,
        pageSize: 10,
        total: 23,
        totalPages: 3,
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
