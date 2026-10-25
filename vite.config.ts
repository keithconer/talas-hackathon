import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function splitFilipinoTtsChunks(text: string, maxLen = 180): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  if (cleaned.length <= maxLen) return [cleaned]

  const chunks: string[] = []
  let remaining = cleaned
  while (remaining.length > maxLen) {
    let splitIdx = -1
    for (const sep of ['. ', '! ', '? ', '; ', ', ', ' ']) {
      const idx = remaining.lastIndexOf(sep, maxLen)
      if (idx > 0) {
        splitIdx = idx + sep.length - 1
        break
      }
    }
    if (splitIdx <= 0) splitIdx = maxLen
    chunks.push(remaining.slice(0, splitIdx + 1).trim())
    remaining = remaining.slice(splitIdx + 1).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

function extractInteractionText(interaction: unknown): string {
  const obj = interaction as {
    output_text?: string
    steps?: Array<{
      content?: string | Array<{ text?: string }>
    }>
  }
  if (typeof obj?.output_text === 'string' && obj.output_text.trim()) {
    return obj.output_text.trim()
  }
  const steps = Array.isArray(obj?.steps) ? obj.steps : []
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    if (typeof step?.content === 'string' && step.content.trim()) {
      return step.content.trim()
    }
    if (Array.isArray(step?.content)) {
      const joined = step.content
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('')
        .trim()
      if (joined) return joined
    }
  }
  return ''
}

function talasGeminiServerPlugin(apiKey: string | undefined): Plugin {
  return {
    name: 'talas-gemini-server',
    configureServer(server) {
      // Google Translate Filipino (tl) MP3 audio endpoint — identical voice to
      // Salita at Larawan (gTTS lang="tl", tld="com", slow=False).
      server.middlewares.use('/api/tts-fil', async (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }
        try {
          const reqUrl = new URL(req.url ?? '', 'http://localhost')
          const q = (reqUrl.searchParams.get('q') ?? '').trim()
          if (!q) {
            res.statusCode = 400
            res.end('Missing q parameter')
            return
          }

          const chunks = splitFilipinoTtsChunks(q, 180)
          const buffers: Uint8Array[] = []
          for (const chunk of chunks) {
            const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=tl&q=${encodeURIComponent(
              chunk,
            )}`
            const ttsRes = await fetch(ttsUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0',
              },
            })
            if (!ttsRes.ok) {
              res.statusCode = 502
              res.end('Failed to fetch Filipino TTS audio')
              return
            }
            const arr = new Uint8Array(await ttsRes.arrayBuffer())
            buffers.push(arr)
          }

          const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0)
          const merged = new Uint8Array(totalLength)
          let offset = 0
          for (const b of buffers) {
            merged.set(b, offset)
            offset += b.byteLength
          }

          res.statusCode = 200
          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('Cache-Control', 'public, max-age=86400')
          res.end(merged)
        } catch {
          res.statusCode = 502
          res.end('TTS proxy error')
        }
      })

      server.middlewares.use('/api/gemini-intervention', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        let rawBody = ''
        req.on('data', (chunk) => {
          rawBody += String(chunk)
        })
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            if (!apiKey) {
              res.statusCode = 500
              res.end(
                JSON.stringify({
                  error: 'GEMINI_API_KEY is not set in .env.local',
                }),
              )
              return
            }

            const body = JSON.parse(rawBody || '{}') as { prompt?: string }
            const prompt = body.prompt ?? ''
            if (!prompt.trim()) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing prompt' }))
              return
            }

            const interactionsUrl = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(
              apiKey,
            )}`
            const modelsToTry = [
              'models/gemini-3.5-flash-lite',
              'models/gemini-3.5-flash',
              'models/gemini-3.8-flash',
            ]
            let lastErr = 'Gemini API request failed.'

            for (const modelName of modelsToTry) {
              const intRes = await fetch(interactionsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: modelName,
                  input: prompt,
                  generation_config: {
                    max_output_tokens: 8192,
                  },
                }),
              })

              if (intRes.ok) {
                const intData = await intRes.json()
                const outputText = extractInteractionText(intData)
                if (outputText) {
                  res.statusCode = 200
                  res.end(
                    JSON.stringify({
                      model: modelName,
                      outputText,
                    }),
                  )
                  return
                }
              } else {
                const errText = await intRes.text().catch(() => '')
                lastErr = `HTTP ${intRes.status} (${modelName}): ${errText.slice(0, 200)}`
              }
            }

            res.statusCode = 502
            res.end(JSON.stringify({ error: lastErr }))
          } catch (err) {
            res.statusCode = 502
            res.end(
              JSON.stringify({
                error:
                  err instanceof Error
                    ? err.message
                    : 'Local Gemini middleware error',
              }),
            )
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      talasGeminiServerPlugin(env.GEMINI_API_KEY),
      VitePWA({
        // Auto-update the service worker in the background; no update prompt UI
        // needed for the demo.
        registerType: 'autoUpdate',
        // Precache the built app shell + static assets so TALAS loads with no
        // network. App data lives in IndexedDB, not the SW cache.
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,gif,ico,woff2,mp3}'],
          // The Vosk WASM chunk is several MB; allow precaching larger files.
          maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
          // Runtime-cache the (large) offline Vosk speech model on first use so
          // oral reading recognition works offline afterwards. Kept out of the
          // precache so the app shell stays small and installs fast.
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/models/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'talas-speech-models',
                expiration: { maxEntries: 4 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        includeAssets: ['imgs/talasLogo.png'],
        manifest: {
          name: 'TALAS',
          short_name: 'TALAS',
          description: 'TALAS learning platform — works offline.',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'imgs/talasLogo.png',
              sizes: '500x500',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },
        // Let the SW serve index.html for client-side routes while offline.
        devOptions: {
          enabled: false,
        },
      }),
    ],
  }
})
