import { test, expect } from '@playwright/test';

// Minimal valid WAV: 8000 Hz, mono, 8-bit PCM, 8 silent samples
const WAV_BYTES = Buffer.from([
  0x52,
  0x49,
  0x46,
  0x46,
  0x2c,
  0x00,
  0x00,
  0x00, // RIFF....
  0x57,
  0x41,
  0x56,
  0x45,
  0x66,
  0x6d,
  0x74,
  0x20, // WAVEfmt
  0x10,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x01,
  0x00, // ........
  0x40,
  0x1f,
  0x00,
  0x00,
  0x40,
  0x1f,
  0x00,
  0x00, // 8000 Hz
  0x01,
  0x00,
  0x08,
  0x00,
  0x64,
  0x61,
  0x74,
  0x61, // ..data
  0x08,
  0x00,
  0x00,
  0x00,
  0x80,
  0x80,
  0x80,
  0x80, // 8 samples
  0x80,
  0x80,
  0x80,
  0x80,
]);

const MINIMAL_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes>
      <divisions>1</divisions>
      <key><fifths>0</fifths></key>
      <time><beats>4</beats><beat-type>4</beat-type></time>
      <clef><sign>G</sign><line>2</line></clef>
    </attributes>
    <note>
      <pitch><step>C</step><octave>4</octave></pitch>
      <duration>4</duration><type>whole</type>
    </note>
  </measure></part>
</score-partwise>`;

const SSE_SUCCESS =
  [
    `data: ${JSON.stringify({ stage: 'validating', pct: 10 })}`,
    `data: ${JSON.stringify({ stage: 'analyzing', pct: 50 })}`,
    `data: ${JSON.stringify({ stage: 'exporting', pct: 90 })}`,
    `data: ${JSON.stringify({ stage: 'done', pct: 100, musicxml: MINIMAL_MUSICXML })}`,
  ].join('\n\n') + '\n\n';

async function uploadViaInput(
  page: import('@playwright/test').Page,
  name = 'test-audio.wav'
) {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'audio/wav',
    buffer: WAV_BYTES,
  });
}

async function uploadViaDrop(
  page: import('@playwright/test').Page,
  name = 'dragged.wav'
) {
  const dataTransfer = await page.evaluateHandle(
    ([wavData, fileName]) => {
      const dt = new DataTransfer();
      dt.items.add(
        new File([new Uint8Array(wavData as number[])], fileName as string, {
          type: 'audio/wav',
        })
      );
      return dt;
    },
    [Array.from(WAV_BYTES), name]
  );
  await page.locator('.border-dashed').dispatchEvent('drop', { dataTransfer });
}

// WaveSurfer may decode the tiny WAV (shows trim zone) or error (goes straight to
// loading). Either way we want to confirm the transcription.
async function confirmTranscription(page: import('@playwright/test').Page) {
  const transcribeBtn = page
    .getByRole('button', { name: /Transcribe/i })
    .first();
  const loadingStage = page.getByText(
    /Validating file|Analyzing audio|Generating sheet music/i
  );

  await Promise.race([
    transcribeBtn.waitFor({ state: 'visible', timeout: 8000 }),
    loadingStage.waitFor({ state: 'visible', timeout: 8000 }),
  ]);

  if (await transcribeBtn.isVisible()) {
    await transcribeBtn.click();
  }
}

async function seedHistory(
  page: import('@playwright/test').Page,
  entries: { filename: string; hash: string; musicxml: string }[]
) {
  await page.evaluate((data) => {
    localStorage.setItem(
      'stafflines-history',
      JSON.stringify(
        data.map((e) => ({ ...e, date: new Date().toISOString() }))
      )
    );
  }, entries);
  await page.reload();
}

test.describe('stafflines', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wipe localStorage so history from one test never bleeds into the next
    await page.evaluate(() => localStorage.clear());
  });

  // ─── Landing page ────────────────────────────────────────────────────────────

  test('landing page renders correctly', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Turn audio into/i })
    ).toBeVisible();
    await expect(page.getByText('stafflines')).toBeVisible();
    await expect(page.getByText('Drop your audio file here')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Browse files/i })
    ).toBeVisible();
    await expect(page.getByText(/MP3, M4A, AAC, WAV/)).toBeVisible();
  });

  // ─── Upload ──────────────────────────────────────────────────────────────────

  test('file input upload transitions to trim zone', async ({ page }) => {
    await uploadViaInput(page);

    await expect(
      page.getByRole('heading', { name: /Select a region to transcribe/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('test-audio.wav')).toBeVisible();
    await expect(page.getByText('Cancel')).toBeVisible();
  });

  test('drag-and-drop upload transitions to trim zone', async ({ page }) => {
    await uploadViaDrop(page, 'dragged.wav');

    await expect(
      page.getByRole('heading', { name: /Select a region to transcribe/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('dragged.wav')).toBeVisible();
  });

  test('dropping a non-audio file is ignored', async ({ page }) => {
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.items.add(
        new File(['not audio'], 'notes.pdf', { type: 'application/pdf' })
      );
      return dt;
    });
    await page
      .locator('.border-dashed')
      .dispatchEvent('drop', { dataTransfer });

    // App must stay on idle — no state transition
    await expect(page.getByText('Drop your audio file here')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Select a region/i })
    ).not.toBeVisible();
  });

  // ─── Trim zone ───────────────────────────────────────────────────────────────

  test('cancel from trim zone returns to idle', async ({ page }) => {
    await uploadViaInput(page);

    await expect(
      page.getByRole('heading', { name: /Select a region to transcribe/i })
    ).toBeVisible({ timeout: 5000 });

    await page.getByText('Cancel').click();

    await expect(page.getByText('Drop your audio file here')).toBeVisible();
  });

  // ─── Transcription flow ──────────────────────────────────────────────────────

  test('loading state shows spinner and stage label', async ({ page }) => {
    await page.route('**/transcribe/stream', async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: SSE_SUCCESS,
      });
    });

    await uploadViaInput(page);
    await confirmTranscription(page);

    // Spinner must appear while the response is in-flight
    await expect(page.locator('.animate-spin').first()).toBeVisible({
      timeout: 5000,
    });
    // At least one stage label must show
    await expect(
      page.getByText(/Validating file|Analyzing audio|Generating sheet music/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('full transcription flow: upload → trim → sheet music renders', async ({
    page,
  }) => {
    await page.route('**/transcribe/stream', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: SSE_SUCCESS,
      })
    );

    await uploadViaInput(page);
    await confirmTranscription(page);

    await expect(page.getByText('Sheet music generated')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('test-audio.wav').first()).toBeVisible();

    // OSMD must have rendered actual SVG into the DOM
    await expect(page.locator('.print-sheet svg').first()).toBeVisible({
      timeout: 10000,
    });

    // Try another returns to idle
    await page.getByRole('button', { name: /Try another/i }).click();
    await expect(page.getByText('Drop your audio file here')).toBeVisible();
  });

  test('error state is shown on transcription failure', async ({ page }) => {
    await page.route('**/transcribe/stream', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Audio too short to transcribe' }),
      })
    );

    await uploadViaInput(page);
    await confirmTranscription(page);

    await expect(page.getByText('Audio too short to transcribe')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole('button', { name: /Try again/i })
    ).toBeVisible();
  });

  test('error state is shown when SSE stream emits an error stage', async ({
    page,
  }) => {
    const SSE_ERROR =
      [
        `data: ${JSON.stringify({ stage: 'validating', pct: 5 })}`,
        `data: ${JSON.stringify({ stage: 'analyzing', pct: 15 })}`,
        `data: ${JSON.stringify({ stage: 'error', pct: 0, detail: 'Transcription backend unavailable' })}`,
      ].join('\n\n') + '\n\n';

    await page.route('**/transcribe/stream', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: SSE_ERROR,
      })
    );

    await uploadViaInput(page);
    await confirmTranscription(page);

    await expect(
      page.getByText('Transcription backend unavailable')
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /Try again/i })
    ).toBeVisible();
  });

  test('try again from error state resets to idle', async ({ page }) => {
    await page.route('**/transcribe/stream', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' }),
      })
    );

    await uploadViaInput(page);
    await confirmTranscription(page);

    await expect(page.getByText('Internal server error')).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: /Try again/i }).click();
    await expect(page.getByText('Drop your audio file here')).toBeVisible();
  });

  // ─── History ─────────────────────────────────────────────────────────────────

  test('successful transcription saves to history', async ({ page }) => {
    await page.route('**/transcribe/stream', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: SSE_SUCCESS,
      })
    );

    await uploadViaInput(page, 'my-song.wav');
    await confirmTranscription(page);

    await expect(page.getByText('Sheet music generated')).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole('button', { name: /Try another/i }).click();

    await expect(page.getByText('Recent')).toBeVisible();
    await expect(page.getByText('my-song.wav')).toBeVisible();
  });

  test('history entry can be removed', async ({ page }) => {
    await seedHistory(page, [
      {
        filename: 'old-recording.mp3',
        hash: 'deadbeef',
        musicxml: '<score-partwise/>',
      },
    ]);

    await expect(page.getByText('old-recording.mp3')).toBeVisible();

    await page.getByLabel('Remove from history').click();

    await expect(page.getByText('old-recording.mp3')).not.toBeVisible();
    // Section header disappears when history is empty
    await expect(page.getByText('Recent')).not.toBeVisible();
  });

  test('history entry reopens sheet music', async ({ page }) => {
    await seedHistory(page, [
      {
        filename: 'archive-piece.mp3',
        hash: 'cafebabe',
        musicxml: MINIMAL_MUSICXML,
      },
    ]);

    await page.getByText('archive-piece.mp3').click();

    await expect(page.getByText('Sheet music generated')).toBeVisible({
      timeout: 5000,
    });
    // OSMD renders the sheet from the stored MusicXML
    await expect(page.locator('.print-sheet svg').first()).toBeVisible({
      timeout: 10000,
    });
  });
});
