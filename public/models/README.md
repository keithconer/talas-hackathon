# Offline speech models (Vosk)

TALAS does oral-reading speech recognition **on-device** with
[Vosk](https://alphacephei.com/vosk/) so it works with no internet. For this to
work, a Vosk model must be present here as a `.tar.gz` file.

## Add the Filipino model

1. Download a Filipino (Tagalog) Vosk model from the official model list:
   https://alphacephei.com/vosk/models
   Look for a `tl` / Filipino model (e.g. `vosk-model-tl-ph-generic-...`).
   A small model is best for the browser (the generic/small ones are tens of MB).

2. The browser build expects a **gzipped tar** of the model folder, named to
   match `DEFAULT_MODEL_URL` in `src/reading/vosk.ts`:

   ```
   public/models/vosk-model-tl.tar.gz
   ```

   To create it from an extracted model folder:

   ```bash
   # macOS/Linux
   tar czf vosk-model-tl.tar.gz -C /path/to vosk-model-tl-ph-generic-0.6

   # Windows (PowerShell, with tar available)
   tar czf vosk-model-tl.tar.gz vosk-model-tl-ph-generic-0.6
   ```

   The archive should contain the model directory with its `conf/`, `am/`,
   `graph/`, etc. inside.

3. Rebuild/redeploy. On first use the PWA service worker caches the model
   (see `vite.config.ts` → `runtimeCaching` for `/models/`), so subsequent
   oral assessments run fully offline.

## Behavior without a model

If no model file is present, TALAS still works:

- **Online:** falls back to the browser Web Speech API (needs a connection).
- **Offline / unsupported browser:** records the audio for teacher review and
  lets the learner/teacher type what was read; the on-device scorer grades it
  the same way.

The app detects the model with a `HEAD` request at startup
(`isModelAvailable`), so dropping the file in and redeploying is all that's
needed to enable offline recognition.

> Note: a different model filename just needs a matching `modelUrl` passed to
> `useSpeechRecognition(lang, modelUrl)` or a change to `DEFAULT_MODEL_URL`.
