import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, Star, Volume2 } from 'lucide-react'
import FrogMascot from '../../../components/FrogMascot'
import { save, syncNow, type PictureQuestionResponse } from '../../../data'
import './PicturePractice.css'

const PICTURE_ACTIVITY_ID = 'picture-word-practice'
const PICTURE_ACTIVITY_TITLE = 'Salita at Larawan'

type ObjectName = 'Upuan' | 'Mesa' | 'Kama' | 'Bola' | 'Aklat'
const questions: { word: ObjectName; syllables: string; choices: ObjectName[]; meaning: string }[] = [
  { word: 'Mesa', syllables: 'me-sa', choices: ['Upuan', 'Mesa', 'Kama'], meaning: 'Ang mesa ay gamit natin sa pagkain at pagsusulat.' },
  { word: 'Bola', syllables: 'bo-la', choices: ['Aklat', 'Upuan', 'Bola'], meaning: 'Ang bola ay bilog at ginagamit sa paglalaro.' },
  { word: 'Kama', syllables: 'ka-ma', choices: ['Kama', 'Mesa', 'Aklat'], meaning: 'Ang kama ay hinihigaan natin kapag natutulog.' },
  { word: 'Aklat', syllables: 'ak-lat', choices: ['Bola', 'Aklat', 'Mesa'], meaning: 'Ang aklat ay may mga kuwento at kaalaman na binabasa natin.' },
  { word: 'Upuan', syllables: 'u-pu-an', choices: ['Mesa', 'Kama', 'Upuan'], meaning: 'Ang upuan ay gamit natin sa pag-upo.' },
]

function Picture({ name }: { name: ObjectName }) {
  return <svg viewBox="0 0 260 190" role="img" aria-label={name} className="picture-art">
    <ellipse cx="130" cy="168" rx="95" ry="10" fill="#edf2e8" />
    <g stroke="#a77442" strokeWidth="3" strokeLinejoin="round">
      {name === 'Mesa' && <><path d="M50 85v76h14V91m132-6v76h14V91M87 65v70h12V70m66 0v65h12V70" fill="#dba56d" /><path d="m33 75 120-30 78 35-121 33Z" fill="#f4c998" /><path d="M33 75v13l77 38 121-34V80l-121 33Z" fill="#e4b47e" /><path d="m110 64 33-8 28 13-34 9Z" fill="#f6fff4" stroke="#8dbb80" /><path d="M174 55V31h17v30" fill="#a8cfe0" stroke="#80a7b9" /><path d="m177 34-3-17m11 18 4-21" stroke="#ecac40" /></>}
      {name === 'Upuan' && <><path d="M83 107v55h13l6-51m62-4 7 55h13l-4-61" fill="#dda66f" /><path d="M84 102 78 55q50-34 98 0l-5 47" fill="#f1c58c" /><path d="M91 99 86 67m77 32 4-32" fill="none" /><path d="m74 110 43-20 73 20-42 22Z" fill="#ffe1ab" /><path d="M74 110v12l74 23 42-23v-12l-42 22Z" fill="#dca26a" /></>}
      {name === 'Kama' && <><path d="M45 155V56q28-17 60 0v62m91 45V91h15v72" fill="#dca574" /><path d="m48 104 54-25 103 43-55 32Z" fill="#fcfcf5" /><path d="m48 114 102 45 55-30v17l-55 30-102-46Z" fill="#dca574" /><path d="m91 103 31-14 74 33-47 26-69-31Z" fill="#a9d5d4" stroke="#77b5b6" /><path d="m103 108 62 27m-46-34 63 27" stroke="#fff4d8" strokeWidth="7" /><path d="m56 101 27-13 30 12-27 14Z" fill="white" stroke="#ceddd6" /></>}
      {name === 'Bola' && <><circle cx="130" cy="100" r="61" fill="#f6c454" stroke="#d59838" /><path d="M69 100h122M130 39v122M90 55q74 45 0 91m80-91q-74 45 0 91" fill="none" stroke="#e08049" strokeWidth="6" /><ellipse cx="110" cy="65" rx="16" ry="8" fill="#ffe7a3" stroke="none" transform="rotate(-30 110 65)" /></>}
      {name === 'Aklat' && <><path d="m50 62 81-20 80 26v87l-80-23-81 17Z" fill="#81bcb2" stroke="#558c83" /><path d="m58 55 73-13 72 19v80l-72-22-73 15Z" fill="#fffbea" stroke="#c9bc91" /><path d="M131 43v76m-60-48 45-9m-45 25 45-9m-45 25 45-9m30-31 43 13m-43 3 43 13m-43 3 43 13" fill="none" stroke="#b9b89e" /></>}
    </g>
  </svg>
}

interface Props { learnerId: string; learnerName: string; onBack: () => void; onComplete: (score: number) => void }

export default function PicturePractice({ learnerId, learnerName, onBack, onComplete }: Props) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<ObjectName | null>(null)
  const [results, setResults] = useState<boolean[]>([])
  const [responses, setResponses] = useState<PictureQuestionResponse[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [audioMessage, setAudioMessage] = useState('')
  const [storageMessage, setStorageMessage] = useState('')
  const storageKey = `talas:picture-stars:${learnerId}`
  const [stars, setStars] = useState(() => {
    try { const value = Number(localStorage.getItem(storageKey)); return Number.isSafeInteger(value) && value >= 0 ? value : 0 } catch { return 0 }
  })
  const locked = useRef(false)
  const completedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playbackId = useRef(0)
  const [audioVisible, setAudioVisible] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const item = questions[index]
  const correct = selected === item.word
  useEffect(() => {
    const audio = audioRef.current
    return () => { playbackId.current++; audio?.pause() }
  }, [])

  function playAudio(clip: string) {
    const audio = audioRef.current
    if (!audio) return
    const currentPlayback = ++playbackId.current
    audio.pause()
    audio.src = `/audio/fil/google-whole-v2/${clip}.mp3`
    setAudioVisible(true)
    setAudioMessage('Inihahanda ang audio…')
    // Start inside the click event so browser autoplay restrictions are respected.
    void audio.play().catch(() => {
      if (currentPlayback === playbackId.current) setAudioMessage('Hindi nagsimula ang audio. Pindutin ang play sa audio player sa ibaba upang subukan muli.')
    })
  }
  function submit() {
    if (!selected || locked.current) return
    locked.current = true
    setSubmitted(true)
    setResults(previous => [...previous, correct])
    setResponses(previous => [...previous, { word: item.word, selected, correct }])
    if (correct) {
      const total = stars + 1
      setStars(total)
      try { localStorage.setItem(storageKey, String(total)) } catch { setStorageMessage('Ang mga bituin ay para sa session na ito lamang; hindi ma-save sa browser.') }
    }
  }
  function next() {
    playbackId.current++
    audioRef.current?.pause()
    setAudioVisible(false)
    setAudioMessage('')
    if (index === questions.length - 1) {
      if (completedRef.current) return
      completedRef.current = true
      const correctAnswers = results.filter(Boolean).length
      const scorePercent = Math.round((correctAnswers / questions.length) * 100)
      void save('pictureAttempts', {
        id: `picture-attempt-${PICTURE_ACTIVITY_ID}-${learnerId}-${Date.now()}`,
        learnerId,
        activityId: PICTURE_ACTIVITY_ID,
        title: PICTURE_ACTIVITY_TITLE,
        correctAnswers,
        totalQuestions: questions.length,
        scorePercent,
        responses,
        online: typeof navigator === 'undefined' ? true : navigator.onLine,
        createdAt: new Date().toISOString(),
      })
        .then(() => syncNow())
        .catch((error) => {
          console.error('[TALAS] Failed to save Salita at Larawan attempt:', error)
        })
      onComplete(scorePercent)
      return
    }
    setIndex(index + 1); setSelected(null); setSubmitted(false); locked.current = false
    heading.current?.focus()
  }

  return <div className="picture-practice" lang="fil">
    <header className="picture-header">
      <button onClick={onBack} className="picture-pill"><ArrowLeft size={16} /> Bumalik</button>
      <span className="picture-brand"><BookOpen size={22} /> TALAS</span>
      <span className="picture-section">Mga Pagsasanay / Salita at Larawan</span>
      <span className="picture-stars"><Star size={16} fill="currentColor" /> {stars} Bituin</span>
      <span className="picture-greeting">Mabuhay, {learnerName.split(' ')[0]}!</span>
    </header>
    <main className="picture-main">
      <div className="picture-toolbar">
        <button className="picture-pill" onClick={onBack}><ArrowLeft size={15} /> Bumalik sa Pagsasanay</button>
        <div className="picture-progress" aria-label={`Tanong ${index + 1} ng ${questions.length}`}>
          <span>Tanong {index + 1} ng {questions.length}</span>
          {questions.map((_, i) => <span key={i} className={`picture-dot ${i === index ? 'current' : ''} ${i < results.length ? (results[i] ? 'correct' : 'incorrect') : ''}`} aria-label={i < results.length ? `Tanong ${i + 1}: ${results[i] ? 'tama' : 'mali'}` : undefined}>{results[i] ? <Check size={10} /> : null}</span>)}
        </div>
        <button className="picture-audio" onClick={() => playAudio('instructions')}><Volume2 size={15} /> Pakinggan ang Panuto</button>
      </div>
      <h1 ref={heading} tabIndex={-1}>Aling larawan ang tumutugma sa salita?</h1>
      <section className="picture-word" aria-label="Salitang babasahin">
        <span className="picture-tag">SALITANG MARUNONG • PANTIG</span>
        <h2>{item.word.toUpperCase()}</h2>
        <button className="picture-audio" onClick={() => playAudio(item.word.toLowerCase())}><Volume2 size={16} /> /{item.syllables}/ • Pakinggan</button>
      </section>
      <div className="picture-choices" role="group" aria-label="Piliin ang larawan">
        {item.choices.map((choice, i) => <button key={choice} aria-pressed={selected === choice} disabled={submitted} onClick={() => setSelected(choice)} className={`picture-choice ${selected === choice ? 'selected' : ''} ${submitted && choice === item.word ? 'answer-correct' : ''} ${submitted && selected === choice && !correct ? 'answer-wrong' : ''}`}>
          <span className="picture-choice-top"><span className="picture-letter">{'ABC'[i]}</span>{selected === choice && <span className="picture-selection"><Check size={12} /> Napiling sagot</span>}</span>
          <span className="picture-frame"><Picture name={choice} /></span>
          <span className="picture-label">{choice}</span>
        </button>)}
      </div>
      <section className="picture-feedback">
        <FrogMascot size={70} />
        <div className="picture-feedback-text" aria-live="polite">
          {submitted ? <><strong>{correct ? 'Magaling! +1 Bituin. ' : 'Subukan muli sa susunod! '}</strong>{item.meaning}<button className="picture-listen" onClick={() => playAudio(item.word.toLowerCase() + '-meaning')}><Volume2 size={13} /> Pakinggan Muli</button></> : <><strong>{selected ? 'Handa ka na ba?' : 'Kaya mo ito!'}</strong> {selected ? 'Pindutin ang Isumite para tingnan ang iyong sagot.' : 'Basahin ang salita at piliin ang katugmang larawan.'}</>}
        </div>
        <button className="picture-submit" disabled={!selected} onClick={submitted ? next : submit}>{submitted ? (index === questions.length - 1 ? 'Tapusin' : 'Susunod') : 'Isumite'} <ArrowRight size={19} /></button>
      </section>
      <audio ref={audioRef} controls hidden={!audioVisible} preload="none" aria-label="Audio sa Filipino" onPlaying={() => setAudioMessage('Pinapakinggan ang audio sa Filipino…')} onEnded={() => setAudioMessage('')} onError={() => setAudioMessage('Hindi ma-load ang audio. Pakisubukan muli.')} style={{ maxWidth: '100%', marginTop: 12 }} />
      <p className="picture-notice" role="status">{audioMessage || storageMessage}</p>
    </main>
    <footer className="picture-footer"><span>TALAS Kaagapay sa Pagbasa</span><span>Isang salita, isang bagong kaalaman.</span></footer>
  </div>
}
