/**
 * TALAS Practice Content Bank — structured catalog.
 *
 * Source: "TALAS Practice Content Bank — Adaptive Continued Development /
 * Practice Materials" (prototype/demo). These are TALAS-created practice and
 * intervention materials, NOT official CRLA assessment items.
 *
 * Categorization (5 levels, two activities each):
 *   - Each level has one MIXED READING activity (levelEvidence = true) that
 *     provides the stronger evidence used for adaptive level movement, and
 *   - one FOCUSED-SKILL activity (levelEvidence = false) that is supportive
 *     only and never moves the learner's level.
 *
 * Every activity carries its reading skills, passage (when any), and questions
 * with the correct answer + explanation, plus the "Difficult Words" glossary
 * from the source so nothing is lost.
 */

/** The adaptive reading levels, 1 (easiest) → 5 (hardest). */
export type ReadingLevel = 1 | 2 | 3 | 4 | 5

/** Human-readable band label per level (from the agreed categorization). */
export const LEVEL_LABEL: Record<ReadingLevel, string> = {
  1: 'Beginner Reading',
  2: 'Developing Reading',
  3: 'Intermediate Reading',
  4: 'Advanced Reading',
  5: 'Higher Reading',
}

/**
 * Automatically selects the learner's next TALAS reading level from their best
 * oral-reading accuracy. This preserves the CRLA cutoffs while using all five
 * Content Bank levels:
 *
 *   < 50%  → Level 1 (early Full Refresher)
 *   50–74% → Level 2 (developing Full Refresher)
 *   75–89% → Level 3 (Moderate Refresher)
 *   90–94% → Level 4 (Light Refresher)
 *   ≥ 95%  → Level 5 (Grade Ready)
 */
export function readingLevelFromAccuracy(accuracyPct: number): ReadingLevel {
  if (accuracyPct >= 95) return 5
  if (accuracyPct >= 90) return 4
  if (accuracyPct >= 75) return 3
  if (accuracyPct >= 50) return 2
  return 1
}

/**
 * Activity category. "mixed-reading" is the primary, level-evidence activity;
 * the rest are focused supporting skills.
 */
export type ActivityCategory =
  | 'mixed-reading'
  | 'word-recognition'
  | 'vocabulary'
  | 'comprehension'
  | 'read-aloud'

/** Reading skills a given activity targets (from the source "Target Skills"). */
export type ReadingSkill =
  | 'decoding'
  | 'literal-comprehension'
  | 'inferential-comprehension'
  | 'main-idea'
  | 'vocabulary'
  | 'fluency'

/** The question type tag the source puts in brackets, e.g. [Literal]. */
export type QuestionKind = 'literal' | 'inferential' | 'main-idea' | 'vocabulary'

export interface BankQuestion {
  kind: QuestionKind
  prompt: string
  choices: [string, string, string, string]
  /** Index into `choices` of the correct answer. */
  correctIndex: number
  explanation: string
}

export interface DifficultWord {
  word: string
  meaning: string
  example: string
}

export interface BankActivity {
  /** Source code, e.g. "L1-MIX-001". Used as the stable activity id. */
  id: string
  title: string
  level: ReadingLevel
  category: ActivityCategory
  /** True for Mixed Reading activities — the ones that drive level movement. */
  levelEvidence: boolean
  skills: ReadingSkill[]
  instruction: string
  /** Passage paragraphs (empty for pure word/vocabulary drills). */
  passage: string[]
  questions: BankQuestion[]
  difficultWords: DifficultWord[]
}

/* ================================================================== */
/* LEVEL 1 — Beginner Reading                                          */
/* ================================================================== */

const L1_MIX: BankActivity = {
  id: 'L1-MIX-001',
  title: 'Si Ana at ang Pusa',
  level: 1,
  category: 'mixed-reading',
  levelEvidence: true,
  skills: ['decoding', 'literal-comprehension', 'main-idea'],
  instruction: 'Basahin ang maikling kuwento at sagutin ang mga tanong.',
  passage: [
    'May pusa si Ana. Ang pangalan nito ay Mimi. Mahilig si Mimi matulog sa banig. Tuwing umaga, binibigyan siya ni Ana ng pagkain at tubig.',
  ],
  questions: [
    {
      kind: 'literal',
      prompt: 'Ano ang pangalan ng pusa ni Ana?',
      choices: ['Mimi', 'Mina', 'Milo', 'Maya'],
      correctIndex: 0,
      explanation: 'Mimi ang pangalan ng pusa ni Ana.',
    },
    {
      kind: 'literal',
      prompt: 'Saan mahilig matulog si Mimi?',
      choices: ['Sa mesa', 'Sa banig', 'Sa silya', 'Sa kahon'],
      correctIndex: 1,
      explanation: 'Sinabi sa kuwento na mahilig matulog si Mimi sa banig.',
    },
    {
      kind: 'main-idea',
      prompt: 'Tungkol saan ang kuwento?',
      choices: [
        'Pag-aalaga ni Ana sa kanyang pusa',
        'Pagpunta ni Ana sa paaralan',
        'Paglalaro sa ulan',
        'Pagluluto ng almusal',
      ],
      correctIndex: 0,
      explanation: 'Ipinapakita ng kuwento kung paano inaalagaan ni Ana si Mimi.',
    },
  ],
  difficultWords: [
    {
      word: 'banig',
      meaning: 'hinabing higaan na inilalatag sa sahig',
      example: 'Natulog si Mimi sa banig.',
    },
  ],
}

const L1_WORD: BankActivity = {
  id: 'L1-WORD-001',
  title: 'Piliin ang Tamang Salita',
  level: 1,
  category: 'word-recognition',
  levelEvidence: false,
  skills: ['decoding', 'vocabulary'],
  instruction: 'Piliin ang salitang babagay sa pangungusap.',
  passage: [],
  questions: [
    {
      kind: 'vocabulary',
      prompt: 'Ang araw ay ____.',
      choices: ['mainit', 'malamig', 'maasim', 'mabigat'],
      correctIndex: 0,
      explanation: 'Mainit ang sikat ng araw.',
    },
    {
      kind: 'vocabulary',
      prompt: 'Umiinom tayo ng ____ kapag nauuhaw.',
      choices: ['tubig', 'bato', 'papel', 'sapatos'],
      correctIndex: 0,
      explanation: 'Tubig ang iniinom natin kapag nauuhaw.',
    },
    {
      kind: 'vocabulary',
      prompt: 'Ginagamit ang payong kapag ____.',
      choices: ['umuulan', 'natutulog', 'kumakain', 'nagsusulat'],
      correctIndex: 0,
      explanation: 'Ginagamit ang payong upang hindi mabasa sa ulan.',
    },
  ],
  difficultWords: [],
}

/* ================================================================== */
/* LEVEL 2 — Developing Reading                                        */
/* ================================================================== */

const L2_MIX: BankActivity = {
  id: 'L2-MIX-001',
  title: 'Ang Baon ni Lino',
  level: 2,
  category: 'mixed-reading',
  levelEvidence: true,
  skills: ['decoding', 'literal-comprehension', 'inferential-comprehension', 'main-idea'],
  instruction: 'Basahin ang kuwento at sagutin ang mga tanong.',
  passage: [
    'Maagang naghanda si Lino para sa paaralan. Naglagay ang kaniyang nanay ng pandesal, saging, at tubig sa kaniyang baunan. Sa oras ng recess, napansin ni Lino na walang baon ang kaniyang kaklaseng si Ben. Hinati niya ang pandesal at ibinigay ang kalahati kay Ben.',
  ],
  questions: [
    {
      kind: 'literal',
      prompt: 'Ano ang nasa baunan ni Lino?',
      choices: [
        'Pandesal, saging, at tubig',
        'Kanin, isda, at gatas',
        'Tinapay at kendi',
        'Prutas lamang',
      ],
      correctIndex: 0,
      explanation: 'Pandesal, saging, at tubig ang inilagay sa baunan ni Lino.',
    },
    {
      kind: 'inferential',
      prompt: 'Bakit hinati ni Lino ang kaniyang pandesal?',
      choices: [
        'Dahil ayaw niya rito',
        'Dahil walang baon si Ben',
        'Dahil busog na siya',
        'Dahil sinabi ng guro',
      ],
      correctIndex: 1,
      explanation: 'Ibinahagi ni Lino ang pagkain dahil napansin niyang walang baon si Ben.',
    },
    {
      kind: 'main-idea',
      prompt: 'Ano ang pinakamahalagang ideya ng kuwento?',
      choices: [
        'Mahalagang magbahagi sa iba',
        'Mas masarap ang pandesal kaysa saging',
        'Dapat maagang matulog',
        'Dapat laging maraming baon',
      ],
      correctIndex: 0,
      explanation: 'Ang pangunahing pangyayari ay ang pagbabahagi ni Lino kay Ben.',
    },
  ],
  difficultWords: [
    {
      word: 'baunan',
      meaning: 'lalagyan ng pagkain na dinadala sa paaralan',
      example: 'Inilagay ni Lino ang pandesal sa baunan.',
    },
    {
      word: 'hinati',
      meaning: 'ginawang dalawang bahagi',
      example: 'Hinati ni Lino ang pandesal.',
    },
  ],
}

const L2_VOCAB: BankActivity = {
  id: 'L2-VOCAB-001',
  title: 'Ano ang Ibig Sabihin?',
  level: 2,
  category: 'vocabulary',
  levelEvidence: false,
  skills: ['vocabulary'],
  instruction: 'Piliin ang pinakamalapit na kahulugan ng salitang may diin.',
  passage: [],
  questions: [
    {
      kind: 'vocabulary',
      prompt: 'Masaya si Nena dahil MASIGLA ang kaniyang halaman.',
      choices: ['malusog at buhay', 'tuyo', 'maliit', 'madilim'],
      correctIndex: 0,
      explanation: 'Ang masiglang halaman ay mukhang malusog at buhay.',
    },
    {
      kind: 'vocabulary',
      prompt: 'MAINGAT na inilagay ni Carlo ang baso sa mesa.',
      choices: ['dahan-dahan at may pag-iingat', 'mabilis', 'magulo', 'malakas'],
      correctIndex: 0,
      explanation: 'Kapag maingat, iniiwasan nating masira o mahulog ang bagay.',
    },
  ],
  difficultWords: [],
}

/* ================================================================== */
/* LEVEL 3 — Intermediate Reading                                      */
/* ================================================================== */

const L3_MIX: BankActivity = {
  id: 'L3-MIX-001',
  title: 'Ang Munting Hardin',
  level: 3,
  category: 'mixed-reading',
  levelEvidence: true,
  skills: ['fluency', 'literal-comprehension', 'inferential-comprehension', 'main-idea'],
  instruction: 'Basahin ang kuwento. Pagkatapos, sagutin ang mga tanong.',
  passage: [
    'Nagtanim si Mara ng kamatis sa isang maliit na paso. Araw-araw niya itong dinidiligan bago pumasok sa paaralan. Isang linggo ang lumipas at may tumubong maliliit na dahon. Tuwang-tuwa si Mara, ngunit napansin niyang nakayuko ang halaman tuwing tanghali. Inilipat niya ang paso sa lugar na may kaunting lilim. Makalipas ang ilang araw, naging mas matibay ang halaman.',
  ],
  questions: [
    {
      kind: 'literal',
      prompt: 'Ano ang itinanim ni Mara?',
      choices: ['Kamatis', 'Mangga', 'Saging', 'Mais'],
      correctIndex: 0,
      explanation: 'Kamatis ang itinanim ni Mara sa maliit na paso.',
    },
    {
      kind: 'inferential',
      prompt: 'Bakit inilipat ni Mara ang paso sa may lilim?',
      choices: [
        'Dahil tila nahihirapan ang halaman sa matinding init',
        'Dahil ayaw niyang diligan ang halaman',
        'Dahil gusto niyang itago ang halaman',
        'Dahil mas madilim doon',
      ],
      correctIndex: 0,
      explanation:
        'Napansin ni Mara na nakayuko ang halaman tuwing tanghali kaya binawasan niya ang direktang init.',
    },
    {
      kind: 'main-idea',
      prompt: 'Ano ang pangunahing mensahe ng kuwento?',
      choices: [
        'Kailangang obserbahan at alagaan nang tama ang halaman',
        'Laging dapat ilagay sa dilim ang halaman',
        'Hindi kailangan ng tubig ang halaman',
        'Mas mabilis tumubo ang halaman sa loob ng bahay',
      ],
      correctIndex: 0,
      explanation:
        'Ipinakita ni Mara ang wastong pag-aalaga sa pamamagitan ng pagdidilig at paglipat ng halaman.',
    },
  ],
  difficultWords: [
    {
      word: 'lilim',
      meaning: 'lugar na hindi direktang nasisikatan ng araw',
      example: 'Umupo sila sa lilim ng puno.',
    },
    {
      word: 'matibay',
      meaning: 'malakas at hindi madaling masira o yumuko',
      example: 'Naging matibay ang tangkay ng halaman.',
    },
  ],
}

const L3_COMP: BankActivity = {
  id: 'L3-COMP-001',
  title: 'Hanapin ang Dahilan',
  level: 3,
  category: 'comprehension',
  levelEvidence: false,
  skills: ['inferential-comprehension', 'main-idea'],
  instruction: 'Basahin ang sitwasyon at piliin ang pinakamahusay na sagot.',
  passage: [
    'Paglabas ni Tino ng bahay, madilim ang ulap at malakas ang hangin. Bumalik siya sa loob at kumuha ng payong bago pumunta sa tindahan.',
  ],
  questions: [
    {
      kind: 'inferential',
      prompt: 'Bakit kumuha ng payong si Tino?',
      choices: [
        'Inakala niyang maaaring umulan',
        'Gusto niyang ipahiram ito',
        'Mainit ang panahon',
        'Gagamitin niya itong laruan',
      ],
      correctIndex: 0,
      explanation:
        'Ang madilim na ulap at malakas na hangin ay palatandaan na maaaring umulan.',
    },
    {
      kind: 'main-idea',
      prompt: 'Ano ang ipinapakita ng ginawa ni Tino?',
      choices: [
        'Naghanda siya bago lumabas',
        'Nakalimutan niya ang pupuntahan',
        'Ayaw niyang pumunta sa tindahan',
        'Takot siya sa payong',
      ],
      correctIndex: 0,
      explanation: 'Kumuha siya ng payong bilang paghahanda sa posibleng ulan.',
    },
  ],
  difficultWords: [],
}

/* ================================================================== */
/* LEVEL 4 — Advanced Reading                                          */
/* ================================================================== */

const L4_MIX: BankActivity = {
  id: 'L4-MIX-001',
  title: 'Ang Lumang Aklatan',
  level: 4,
  category: 'mixed-reading',
  levelEvidence: true,
  skills: [
    'fluency',
    'literal-comprehension',
    'inferential-comprehension',
    'main-idea',
    'vocabulary',
  ],
  instruction: 'Basahin ang kuwento at sagutin ang mga tanong.',
  passage: [
    'Tuwing Miyerkules, pumupunta si Bea sa maliit na aklatan malapit sa kanilang paaralan. Isang araw, napansin niyang kakaunti na lamang ang batang bumibisita roon. Marami sa mga aklat ay maayos pa, ngunit nakatago sa matataas na estante at walang malinaw na mga karatula. Kinausap ni Bea ang tagapangalaga at nagmungkahi silang gumawa ng makukulay na palatandaan para sa iba\'t ibang uri ng aklat. Pagkaraan ng ilang linggo, mas maraming bata ang nagsimulang bumisita at manghiram.',
  ],
  questions: [
    {
      kind: 'literal',
      prompt: 'Ano ang napansin ni Bea sa aklatan?',
      choices: [
        'Kakaunti na lamang ang batang bumibisita',
        'Wala nang aklat',
        'Sarado ang aklatan',
        'Nasira ang lahat ng estante',
      ],
      correctIndex: 0,
      explanation: 'Napansin ni Bea na kakaunti na lamang ang batang bumibisita.',
    },
    {
      kind: 'inferential',
      prompt: 'Paano nakatulong ang mga bagong palatandaan?',
      choices: [
        'Mas madaling makita at piliin ng mga bata ang aklat',
        'Naging mas malaki ang gusali',
        'Nadagdagan agad ang lahat ng aklat',
        'Naging mas maikli ang oras ng klase',
      ],
      correctIndex: 0,
      explanation:
        "Ang malinaw na palatandaan ay nakatulong para madaling makita ang iba't ibang uri ng aklat.",
    },
    {
      kind: 'main-idea',
      prompt: 'Ano ang pangunahing ideya ng kuwento?',
      choices: [
        'Ang simpleng pagbabago ay maaaring makatulong upang mas magamit ang aklatan',
        'Dapat alisin ang matataas na estante',
        'Mas mabuti ang bagong aklat kaysa luma',
        'Hindi gusto ng mga bata ang pagbabasa',
      ],
      correctIndex: 0,
      explanation:
        'Ipinakita ng kuwento na ang mas maayos na pag-aayos at gabay ay nakahikayat ng mas maraming mambabasa.',
    },
  ],
  difficultWords: [
    {
      word: 'tagapangalaga',
      meaning: 'taong nag-aalaga o namamahala sa isang lugar o bagay',
      example: 'Tinulungan sila ng tagapangalaga ng aklatan.',
    },
    {
      word: 'palatandaan',
      meaning: 'senyas o karatulang nagbibigay ng gabay',
      example: 'May palatandaan kung saan makikita ang mga kuwento.',
    },
  ],
}

const L4_READ: BankActivity = {
  id: 'L4-READ-001',
  title: 'Basahin Nang Malinaw',
  level: 4,
  category: 'read-aloud',
  levelEvidence: false,
  skills: ['fluency', 'decoding'],
  instruction:
    'Basahin nang malakas at malinaw ang talata. Maaari mong pakinggan ang halimbawa bago magsimula.',
  passage: [
    'Maagang dumating ang mga mag-aaral sa paaralan upang ihanda ang kanilang munting eksibit. Inayos nila ang mga larawan, maikling paliwanag, at mga likhang-sining. Nang dumating ang mga bisita, buong sigla nilang ipinaliwanag ang kanilang ginawa.',
  ],
  questions: [],
  difficultWords: [],
}

/* ================================================================== */
/* LEVEL 5 — Higher Reading                                            */
/* ================================================================== */

const L5_MIX: BankActivity = {
  id: 'L5-MIX-001',
  title: 'Tubig para sa Barangay',
  level: 5,
  category: 'mixed-reading',
  levelEvidence: true,
  skills: [
    'fluency',
    'literal-comprehension',
    'inferential-comprehension',
    'main-idea',
    'vocabulary',
  ],
  instruction: 'Basahin ang teksto at sagutin ang mga tanong.',
  passage: [
    'Sa isang barangay, napansin ng mga residente na mas kaunti ang tubig na naiipon sa kanilang mga tangke tuwing tag-init. Sa halip na hintayin lumala ang problema, nagtipon sila upang magplano. Naglagay sila ng mga sisidlan para sa tubig-ulan, inayos ang mga tumutulong gripo, at nagtakda ng oras para sa pagdidilig ng mga halaman. Makalipas ang isang buwan, nabawasan ang nasasayang na tubig at mas naging maingat ang mga pamilya sa paggamit nito.',
  ],
  questions: [
    {
      kind: 'literal',
      prompt: 'Ano ang isang hakbang na ginawa ng mga residente?',
      choices: [
        'Naglagay ng sisidlan para sa tubig-ulan',
        'Itinigil ang paggamit ng tubig',
        'Tinanggal ang lahat ng halaman',
        'Lumipat sa ibang barangay',
      ],
      correctIndex: 0,
      explanation: 'Isa sa kanilang ginawa ang pag-iipon ng tubig-ulan.',
    },
    {
      kind: 'inferential',
      prompt: 'Bakit inayos nila ang mga tumutulong gripo?',
      choices: [
        'Upang mabawasan ang nasasayang na tubig',
        'Upang lumakas ang ulan',
        'Upang dumami ang halaman',
        'Upang masira ang tangke',
      ],
      correctIndex: 0,
      explanation: 'Ang tumutulong gripo ay nagsasayang ng tubig kaya inayos nila ito.',
    },
    {
      kind: 'main-idea',
      prompt: 'Ano ang pangunahing ideya ng teksto?',
      choices: [
        'Makakatulong ang sama-samang pagkilos sa pagtitipid ng tubig',
        'Mas mabuti ang tag-init kaysa tag-ulan',
        'Kailangang alisin ang lahat ng gripo',
        'Hindi mahalaga ang pag-iipon ng tubig',
      ],
      correctIndex: 0,
      explanation:
        'Ipinakita ng barangay na ang sama-samang plano ay nakabawas sa pag-aaksaya ng tubig.',
    },
  ],
  difficultWords: [
    {
      word: 'residente',
      meaning: 'taong nakatira sa isang lugar',
      example: 'Nagtipon ang mga residente ng barangay.',
    },
    {
      word: 'sisidlan',
      meaning: 'lalagyan ng tubig o iba pang bagay',
      example: 'Naglagay sila ng sisidlan para sa tubig-ulan.',
    },
  ],
}

const L5_COMP: BankActivity = {
  id: 'L5-COMP-001',
  title: 'Ano ang Pinakamainam na Paliwanag?',
  level: 5,
  category: 'comprehension',
  levelEvidence: false,
  skills: ['inferential-comprehension', 'main-idea'],
  instruction: 'Basahin ang sitwasyon at piliin ang sagot na may pinakamalinaw na paliwanag.',
  passage: [
    'Napansin ni Ella na mas mabilis matapos ang kanilang pangkat kapag hinahati nila ang gawain ayon sa kakayahan ng bawat isa. Sa susunod na proyekto, nagtalaga sila agad ng tagasulat, tagaguhit, at tagapagsalita.',
  ],
  questions: [
    {
      kind: 'inferential',
      prompt: 'Bakit naghati sila agad ng gawain sa susunod na proyekto?',
      choices: [
        'Dahil nakita nilang mas maayos at mabilis silang nakakagawa kapag malinaw ang tungkulin',
        'Dahil ayaw nilang mag-usap',
        'Dahil iisa lamang ang marunong gumawa',
        'Dahil gusto nilang matapos nang walang plano',
      ],
      correctIndex: 0,
      explanation:
        'Batay sa unang karanasan, naging mas mabilis ang grupo kapag malinaw ang gawain ng bawat isa.',
    },
    {
      kind: 'main-idea',
      prompt: 'Ano ang aral sa sitwasyon?',
      choices: [
        'Nakakatulong ang maayos na paghahati ng tungkulin sa pagtutulungan',
        'Mas mabuti ang gumawa nang mag-isa',
        'Hindi mahalaga ang plano',
        'Dapat pare-pareho ang gawain ng lahat',
      ],
      correctIndex: 0,
      explanation:
        'Ang maayos na paghahati ng gawain ay nakatulong sa mas epektibong pagtutulungan.',
    },
  ],
  difficultWords: [],
}

/* ================================================================== */
/* Catalog + lookups                                                   */
/* ================================================================== */

/** The full content bank — all 10 activities across 5 levels. */
export const CONTENT_BANK: BankActivity[] = [
  L1_MIX,
  L1_WORD,
  L2_MIX,
  L2_VOCAB,
  L3_MIX,
  L3_COMP,
  L4_MIX,
  L4_READ,
  L5_MIX,
  L5_COMP,
]

/** Fast id → activity lookup. */
export const CONTENT_BY_ID: Record<string, BankActivity> = Object.fromEntries(
  CONTENT_BANK.map((a) => [a.id, a]),
)

/** Returns the activity for an id, or undefined. */
export function getActivity(id: string): BankActivity | undefined {
  return CONTENT_BY_ID[id]
}

/** All activities at a given reading level. */
export function activitiesForLevel(level: ReadingLevel): BankActivity[] {
  return CONTENT_BANK.filter((a) => a.level === level)
}

/** The mixed-reading (level-evidence) activity for a level. */
export function mixedReadingForLevel(level: ReadingLevel): BankActivity | undefined {
  return CONTENT_BANK.find((a) => a.level === level && a.levelEvidence)
}

/** All activities that target a particular reading skill. */
export function activitiesForSkill(skill: ReadingSkill): BankActivity[] {
  return CONTENT_BANK.filter((a) => a.skills.includes(skill))
}
