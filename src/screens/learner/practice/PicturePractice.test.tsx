import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PicturePractice from './PicturePractice'
import {
  listPictureAttemptsByLearner,
  listReadingAttemptsByLearner,
  listSilentAttemptsByLearner,
} from '../../../data'

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('picture practice', () => {
  it('plays the unedited whole-word recording without browser speech voices and stops on exit', () => {
    const { unmount } = render(<PicturePractice learnerId="student-a" learnerName="Ana" onBack={vi.fn()} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '/me-sa/ • Pakinggan' }))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Audio sa Filipino')).toHaveAttribute('src', '/audio/fil/google-whole-v2/mesa.mp3')
    expect(screen.getByLabelText('Audio sa Filipino')).toBeVisible()
    unmount()
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2)
  })
  it('requires submission, scores each question once, and saves results for the teacher separately from oral and silent reading', async () => {
    const complete = vi.fn()
    render(<PicturePractice learnerId="student-a" learnerName="Ana" onBack={vi.fn()} onComplete={complete} />)
    expect(screen.getByRole('button', { name: 'Isumite' })).toBeDisabled()
    const choose = (word: string) => fireEvent.click(screen.getByRole('img', { name: word }).closest('button')!)
    choose('Upuan')
    choose('Mesa')
    expect(localStorage.getItem('talas:picture-stars:student-a')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Isumite' }))
    expect(localStorage.getItem('talas:picture-stars:student-a')).toBe('1')
    expect(screen.getByRole('img', { name: 'Mesa' }).closest('button')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Susunod' }))
    // One wrong answer, followed by three correct answers: 4/5 = 80%.
    for (const [i, word] of ['Aklat', 'Kama', 'Aklat', 'Upuan'].entries()) {
      choose(word)
      fireEvent.click(screen.getByRole('button', { name: 'Isumite' }))
      fireEvent.click(screen.getByRole('button', { name: i === 3 ? 'Tapusin' : 'Susunod' }))
    }
    expect(complete).toHaveBeenCalledExactlyOnceWith(80)
    expect(localStorage.getItem('talas:picture-stars:student-a')).toBe('4')
    expect(localStorage.getItem('talas:picture-stars:student-b')).toBeNull()

    await waitFor(async () => {
      const savedPicture = await listPictureAttemptsByLearner('student-a')
      expect(savedPicture).toHaveLength(1)
      expect(savedPicture[0]).toMatchObject({
        learnerId: 'student-a',
        title: 'Salita at Larawan',
        correctAnswers: 4,
        totalQuestions: 5,
        scorePercent: 80,
      })
      expect(savedPicture[0].responses).toEqual([
        { word: 'Mesa', selected: 'Mesa', correct: true },
        { word: 'Bola', selected: 'Aklat', correct: false },
        { word: 'Kama', selected: 'Kama', correct: true },
        { word: 'Aklat', selected: 'Aklat', correct: true },
        { word: 'Upuan', selected: 'Upuan', correct: true },
      ])
    })

    // Salita at Larawan results must never pollute oral or silent reading stores.
    expect(await listReadingAttemptsByLearner('student-a')).toHaveLength(0)
    expect(await listSilentAttemptsByLearner('student-a')).toHaveLength(0)
  })

  it('uses the unedited whole-word recording for aklat', () => {
    render(<PicturePractice learnerId="student-a" learnerName="Ana" onBack={vi.fn()} onComplete={vi.fn()} />)
    for (const word of ['Mesa', 'Bola', 'Kama']) {
      fireEvent.click(screen.getByRole('img', { name: word }).closest('button')!)
      fireEvent.click(screen.getByRole('button', { name: 'Isumite' }))
      fireEvent.click(screen.getByRole('button', { name: 'Susunod' }))
    }
    fireEvent.click(screen.getByRole('button', { name: '/ak-lat/ • Pakinggan' }))
    expect(screen.getByLabelText('Audio sa Filipino')).toHaveAttribute('src', '/audio/fil/google-whole-v2/aklat.mp3')
    fireEvent.click(screen.getByRole('img', { name: 'Aklat' }).closest('button')!)
    fireEvent.click(screen.getByRole('button', { name: 'Isumite' }))
    fireEvent.click(screen.getByRole('button', { name: 'Susunod' }))
    fireEvent.click(screen.getByRole('button', { name: '/u-pu-an/ • Pakinggan' }))
    expect(screen.getByLabelText('Audio sa Filipino')).toHaveAttribute('src', '/audio/fil/google-whole-v2/upuan.mp3')
  })

  it('loads only the current learner rewards and offers native playback after a rejected play request', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('Playback blocked'))
    localStorage.setItem('talas:picture-stars:student-a', '12')
    render(<PicturePractice learnerId="student-b" learnerName="Ben" onBack={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getByText('0 Bituin')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Pakinggan ang Panuto/ }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Pindutin ang play'))
    expect(screen.getByLabelText('Audio sa Filipino')).toHaveAttribute('src', '/audio/fil/google-whole-v2/instructions.mp3')
    expect(screen.getByLabelText('Audio sa Filipino')).toBeVisible()
  })
})
