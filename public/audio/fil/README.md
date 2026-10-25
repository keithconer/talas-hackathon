# Filipino picture-practice audio

Active files: `google-whole-v2/*.mp3`. These are the original MP3 responses
from Google Translate speech, requested through gTTS 2.5.4 with language `tl`,
domain `com`, normal speed. See https://gtts.readthedocs.io/en/latest/.

Each word is sent as one complete word: mesa, bola, kama, aklat, upuan.
There is no slicing, syllable joining, inserted silence, speed adjustment,
or audio conversion. Displayed syllables remain a visual reading aid only.
Instructions and meanings use whole sentences.

Only fixed lesson text is sent at generation time; no student data is used.
Playback uses bundled MP3 files, including production offline precaching.
The versioned path prevents reuse of the old syllable recordings.

Regenerate using `scripts/generate-picture-audio.py` with gTTS 2.5.4 installed.
Google can update its speech service; bundled files stay fixed until regenerated.
