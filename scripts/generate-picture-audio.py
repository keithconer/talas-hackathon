"""Generate unedited Google Translate Filipino audio (gTTS==2.5.4).

Only fixed lesson text is sent. No learner data is used. Save the returned
MP3 directly: no syllable splicing, inserted pauses, or speed changes.
"""
from pathlib import Path
from gtts import gTTS

OUTPUT = Path(__file__).resolve().parents[1] / "public" / "audio" / "fil" / "google-whole-v2"
CLIPS = {
    "mesa": "mesa",
    "bola": "bola",
    "kama": "kama",
    "aklat": "aklat",
    "upuan": "upuan",
    "instructions": "Aling larawan ang tumutugma sa salita? Piliin ang larawan, pagkatapos ay pindutin ang Isumite.",
    "mesa-meaning": "Ang mesa ay gamit natin sa pagkain at pagsusulat.",
    "bola-meaning": "Ang bola ay bilog at ginagamit sa paglalaro.",
    "kama-meaning": "Ang kama ay hinihigaan natin kapag natutulog.",
    "aklat-meaning": "Ang aklat ay may mga kuwento at kaalaman na binabasa natin.",
    "upuan-meaning": "Ang upuan ay gamit natin sa pag-upo.",
}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, text in CLIPS.items():
        destination = OUTPUT / f"{name}.mp3"
        gTTS(text, lang="tl", tld="com", slow=False, timeout=30).save(str(destination))
        print(f"{name}.mp3: {destination.stat().st_size} bytes", flush=True)


if __name__ == "__main__":
    main()
