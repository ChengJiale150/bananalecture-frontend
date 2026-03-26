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
    const { listProjects } = await import('@/features/projects/api');
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

test('downloadVideoFile requests the proxied file endpoint and preserves filename', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });

    return new Response(new Blob(['video-bytes'], { type: 'video/mp4' }), {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="lesson.mp4"',
      },
    });
  }) as typeof fetch;

  try {
    const { downloadVideoFile } = await import('@/features/projects/api');
    const result = await downloadVideoFile('project-42');

    assert.equal(calls.length, 1);
    assert.equal((calls[0].init?.method ?? 'GET').toUpperCase(), 'GET');
    assert.match(String(calls[0].input), /\/api\/v1\/projects\/project-42\/video\/file/);
    assert.equal(result.filename, 'lesson.mp4');
    assert.equal(result.blob.type, 'video/mp4');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('modifySlideImage posts prompt payload to the proxied modify endpoint', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });

    return new Response(
      JSON.stringify({
        code: 200,
        message: '图片修改成功',
        data: null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const { modifySlideImage } = await import('@/features/projects/api');
    await modifySlideImage('project-1', 'slide-2', '改成教室背景');

    assert.equal(calls.length, 1);
    assert.equal((calls[0].init?.method ?? 'GET').toUpperCase(), 'POST');
    assert.match(String(calls[0].input), /\/api\/v1\/projects\/project-1\/slides\/slide-2\/image\/modify/);
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { prompt: '改成教室背景' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reorderDialogues posts ordered dialogue ids to the proxy endpoint', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });

    return new Response(
      JSON.stringify({
        code: 200,
        message: '对话排序更新成功',
        data: { dialogues: [] },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const { reorderDialogues } = await import('@/features/projects/api');
    await reorderDialogues('project-1', 'slide-2', ['dialogue-2', 'dialogue-1']);

    assert.equal(calls.length, 1);
    assert.equal((calls[0].init?.method ?? 'GET').toUpperCase(), 'POST');
    assert.match(String(calls[0].input), /\/api\/v1\/projects\/project-1\/slides\/slide-2\/dialogues\/reorder/);
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { dialogue_ids: ['dialogue-2', 'dialogue-1'] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reorderSlides posts ordered slide ids to the proxy endpoint', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });

    return new Response(
      JSON.stringify({
        code: 200,
        message: '幻灯片排序更新成功',
        data: { slides: [] },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const { reorderSlides } = await import('@/features/projects/api');
    await reorderSlides('project-1', ['slide-3', 'slide-1']);

    assert.equal(calls.length, 1);
    assert.equal((calls[0].init?.method ?? 'GET').toUpperCase(), 'POST');
    assert.match(String(calls[0].input), /\/api\/v1\/projects\/project-1\/slides\/reorder/);
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { slide_ids: ['slide-3', 'slide-1'] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getDialogueAudioUrl builds the proxied dialogue audio path', async () => {
  const { getDialogueAudioUrl } = await import('@/features/projects/api');
  const result = getDialogueAudioUrl('project-1', 'slide-2', 'dialogue-3');

  assert.equal(result, '/api/v1/projects/project-1/slides/slide-2/dialogues/dialogue-3/audio/file');
});
