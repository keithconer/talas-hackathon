export interface Assignment {
  title: string
  level: string
  estimatedMinutes: number
}

export interface QuizQuestion {
  question: string
  choices: [string, string, string, string]
  correctIndex: number
  explanation: string
}

export const mockAssignment: Assignment = {
  title: 'Ang Batang Magsasaka',
  level: 'Baitang 3',
  estimatedMinutes: 5,
}

export const mockPassage: string[] = [
  'Si Nino ay isang batang magsasaka. Nakatira siya sa isang maliit na nayon malapit sa bundok. Araw-araw, tinutulungan niya ang kanyang ama sa palayan.',
  'Isang umaga, maagang bumangon si Nino. Kinuha niya ang kanyang asarol at pumunta sa bukid. Masaya siyang nagtrabaho kahit mainit ang araw.',
  'Nang tanghali, nagdala ang kanyang ina ng pagkain. Kumain silang magkasama sa ilalim ng malaking puno. Masarap ang kanin at gulay na niluto ng kanyang ina.',
  'Sa hapon, natapos na nila ang trabaho. Tiningnan ni Nino ang palayan at ngumiti siya. Ipinagmamalaki niya ang kanyang pamilya at ang kanilang pagsisikap.',
]

export const mockQuiz: QuizQuestion[] = [
  {
    question: 'Saan nakatira si Nino?',
    choices: [
      'Sa lungsod',
      'Sa isang nayon malapit sa bundok',
      'Sa tabi ng dagat',
      'Sa gitna ng kagubatan',
    ],
    correctIndex: 1,
    explanation: 'Nakatira si Nino sa isang nayon malapit sa bundok ayon sa kwento.',
  },
  {
    question: 'Ano ang ginagawa ni Nino sa palayan?',
    choices: [
      'Naglalaro siya',
      'Natutulog siya',
      'Tinutulungan niya ang kanyang ama',
      'Nag-aaral siya',
    ],
    correctIndex: 2,
    explanation: 'Sinabi sa kwento na tinutulungan ni Nino ang kanyang ama sa palayan.',
  },
  {
    question: 'Sino ang nagdala ng pagkain nang tanghali?',
    choices: [
      'Ang kanyang ama',
      'Ang kanyang kaibigan',
      'Ang kanyang guro',
      'Ang kanyang ina',
    ],
    correctIndex: 3,
    explanation: 'Ang kanyang ina ang nagdala ng pagkain nang tanghali sa bukid.',
  },
  {
    question: 'Paano naramdaman ni Nino pagkatapos ng trabaho?',
    choices: [
      'Galit siya',
      'Malungkot siya',
      'Ipinagmamalaki niya ang kanyang pamilya',
      'Pagod na pagod siya',
    ],
    correctIndex: 2,
    explanation: 'Ipinagmamalaki ni Nino ang kanyang pamilya at ang kanilang pagsisikap.',
  },
]
