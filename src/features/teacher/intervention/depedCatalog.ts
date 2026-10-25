import type { InterventionCategory, MaterialSourceAttribution } from "../../../data/types";

/**
 * Official DepEd Learning Resources Portal page for ARAL Supplementary Materials, SY 2026–2027.
 * Note: The portal does not provide a public REST API and raw Google Drive downloads require
 * @deped.gov.ph authentication. We curate the official Key Stage 1 (Grades 1–3) metadata here
 * and link directly to the verified DepEd LR Portal page without fabricating download links.
 */
export const DEPED_ARAL_LR_PORTAL_URL =
  "https://sites.google.com/deped.gov.ph/deped-lrportal/aral-reading-program-reading/aral-supplementary-materials-sy-2026-2027";

export type DepEdMaterialType =
  | "reading passage"
  | "worksheet"
  | "activity sheet"
  | "assessment"
  | "learner's workbook"
  | "tutor's guide";

export interface DepEdResource {
  id: string;
  title: string;
  gradeLevel: 1 | 2 | 3;
  literacySkill: string;
  category: InterventionCategory;
  language: "Filipino";
  sourceUrl: string;
  materialType: DepEdMaterialType;
  applicableReadingLevel: string;
  summary: string;
}

/**
 * Curated catalog of DepEd ARAL Reading Program (Key Stage 1: Grades 1–3) supplementary
 * materials from the official SY 2026–2027 LR Portal page.
 */
export const DEPED_LR_CATALOG: readonly DepEdResource[] = [
  {
    id: "deped-aral-ks1-g1-marungko-wb",
    title: "ARAL Reading KS1 Basic (Filipino) — Learner's Workbook: Unang Hakbang sa Pagbasa (Marungko)",
    gradeLevel: 1,
    literacySkill: "Pagkilala sa tunog ng titik at pagsasama ng pantig gamit ang Marungko Approach (m, s, a, i, o, b)",
    category: "Marungko",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "learner's workbook",
    applicableReadingLevel: "Full Refresher / Moderate Refresher (Baitang 1)",
    summary:
      "Opisyal na ARAL Reading KS1 Basic workbook sa Filipino para sa pagsasanay ng tunog ng titik, pantig, at parirala sa pagkakasunod-sunod ng Marungko.",
  },
  {
    id: "deped-aral-ks1-g1-letter-sounds-tg",
    title: "ARAL Reading KS1 Basic (Filipino) — Tutor's Guide: Kamalayang Ponolohiko at Tunog ng Titik",
    gradeLevel: 1,
    literacySkill: "Pagtukoy sa unahan, gitna, at hulihang tunog ng titik at pagtutugma ng titik sa larawan",
    category: "Letter Sounds",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "activity sheet",
    applicableReadingLevel: "Full Refresher (Baitang 1)",
    summary:
      "Gabay at gawaing pagsasanay mula sa DepEd ARAL Reading Program para sa pagkilala ng tunog ng mga katinig at patinig sa Baitang 1.",
  },
  {
    id: "deped-aral-ks1-g1-word-rec-ws",
    title: "ARAL Reading KS1 Basic (Filipino) — Activity Sheet: Pagkilala ng Karaniwang Salita at Sight Words",
    gradeLevel: 1,
    literacySkill: "Pagbasa ng CVC/CV-CV na salita at karaniwang salitang Filipino sa unang kita",
    category: "Word Recognition",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "worksheet",
    applicableReadingLevel: "Moderate Refresher / Light Refresher (Baitang 1)",
    summary:
      "Sanayang papel sa pagbasa ng mga payak na salitang Filipino at pag-uugnay ng salita sa kahulugan o larawan.",
  },
  {
    id: "deped-aral-ks1-g1-short-stories-rp",
    title: "ARAL Reading KS1 Basic (Filipino) — Maiikling Kuwento at Tanong sa Pag-unawa (Baitang 1)",
    gradeLevel: 1,
    literacySkill: "Pagbasa nang malakas at pagsagot sa literal na tanong mula sa maikling kuwento",
    category: "Short Stories",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "reading passage",
    applicableReadingLevel: "Light Refresher / Grade Ready (Baitang 1)",
    summary:
      "Mga maikling babasahin sa Filipino mula sa ARAL KS1 Basic na may gabay na tanong para sa literal na pag-unawa.",
  },
  {
    id: "deped-aral-ks1-g2-marungko-wb",
    title: "ARAL Reading KS1 Basic (Filipino) — Pagsasanay sa Pantig at Salita (Marungko Baitang 2)",
    gradeLevel: 2,
    literacySkill: "Pagbasa ng mga salitang may kambal-katinig at patuloy na pagsasanay sa Marungko sequence",
    category: "Marungko",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "learner's workbook",
    applicableReadingLevel: "Full Refresher / Moderate Refresher (Baitang 2)",
    summary:
      "Sanayang materyal mula sa DepEd ARAL KS1 Basic para sa mga mag-aaral sa Baitang 2 na nangangailangan ng pagpapatibay sa pantig at pagbuo ng salita.",
  },
  {
    id: "deped-aral-ks1-g2-letter-sounds-as",
    title: "ARAL Reading KS1 Basic (Filipino) — Pagsasanay sa Ponolohiya at Klaster (Baitang 2)",
    gradeLevel: 2,
    literacySkill: "Pagkilala ng tunog ng titik, diptonggo, at kambal-katinig sa Filipino",
    category: "Letter Sounds",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "activity sheet",
    applicableReadingLevel: "Full Refresher / Moderate Refresher (Baitang 2)",
    summary:
      "Gawaing papel mula sa DepEd ARAL Reading Program sa pagkilala at pagbigkas ng mga tunog ng titik at klaster.",
  },
  {
    id: "deped-aral-ks1-g2-word-rec-ws",
    title: "ARAL Reading KS1 Plus (Filipino) — Pagpapalawak ng Talasalitaan at Pagkilala ng Salita (Baitang 2)",
    gradeLevel: 2,
    literacySkill: "Mabilis at wastong pagkilala ng mga salitang may panlapi at gamiting salita sa Baitang 2",
    category: "Word Recognition",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "worksheet",
    applicableReadingLevel: "Moderate Refresher / Light Refresher (Baitang 2)",
    summary:
      "Sanayang papel mula sa ARAL KS1 Plus para sa pagpapabilis ng pagbasa ng salita at pag-unawa sa talasalitaan.",
  },
  {
    id: "deped-aral-ks1-g2-short-stories-rp",
    title: "ARAL Reading KS1 Plus (Filipino) — Babasahing Kuwento at Pag-unawa sa Binasa (Baitang 2)",
    gradeLevel: 2,
    literacySkill: "Pag-unawa sa maikling kuwento, pagtukoy sa tauhan, tagpuan, at pagkakasunod-sunod ng pangyayari",
    category: "Short Stories",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "reading passage",
    applicableReadingLevel: "Moderate Refresher / Light Refresher (Baitang 2)",
    summary:
      "Mga babasahing kuwento mula sa DepEd ARAL KS1 Plus na may kasamang tanong sa talasalitaan at pag-unawa.",
  },
  {
    id: "deped-aral-ks1-g3-marungko-wb",
    title: "ARAL Reading KS1 Basic (Filipino) — Remedial Marungko at Pagbubuo ng Salita (Baitang 3)",
    gradeLevel: 3,
    literacySkill: "Remedial na pagbasa ng pantig, parirala, at pangungusap gamit ang Marungko sequence",
    category: "Marungko",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "learner's workbook",
    applicableReadingLevel: "Full Refresher (Baitang 3)",
    summary:
      "Remedial workbook mula sa DepEd ARAL KS1 Basic para sa mga mag-aaral sa Baitang 3 na nasa Full Refresher level.",
  },
  {
    id: "deped-aral-ks1-g3-letter-sounds-as",
    title: "ARAL Reading KS1 Basic (Filipino) — Pagsasanay sa Tunog ng Titik, Diptonggo, at Digrapo (Baitang 3)",
    gradeLevel: 3,
    literacySkill: "Pagtukoy at pagbasa ng tunog ng titik, ng, klaster, at diptonggo",
    category: "Letter Sounds",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "activity sheet",
    applicableReadingLevel: "Full Refresher / Moderate Refresher (Baitang 3)",
    summary:
      "Sanayang papel mula sa DepEd ARAL Reading Program para sa ponolohiya at wastong pagbigkas sa Baitang 3.",
  },
  {
    id: "deped-aral-ks1-g3-word-rec-ws",
    title: "ARAL Reading KS1 Plus (Filipino) — Pagkilala sa Mahahabang Salita at Konteksto (Baitang 3)",
    gradeLevel: 3,
    literacySkill: "Pagbasa ng mga salitang may unlapi, gitlapi, at hulapi at paggamit sa pangungusap",
    category: "Word Recognition",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "worksheet",
    applicableReadingLevel: "Moderate Refresher / Light Refresher (Baitang 3)",
    summary:
      "ARAL KS1 Plus worksheet para sa mabilis na pagkilala ng salita at pag-unawa sa kahulugan gamit ang pangungusap.",
  },
  {
    id: "deped-aral-ks1-g3-short-stories-rp",
    title: "ARAL Reading KS1 Plus (Filipino) — Maiikling Kuwento at Pagsusuri sa Binasa (Baitang 3)",
    gradeLevel: 3,
    literacySkill: "Pagbasa nang may katatasan at pagsagot sa literal at hinuha na tanong mula sa maikling kuwento",
    category: "Short Stories",
    language: "Filipino",
    sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
    materialType: "reading passage",
    applicableReadingLevel: "Moderate Refresher / Light Refresher (Baitang 3)",
    summary:
      "Mga babasahing teksto mula sa DepEd ARAL KS1 Plus SY 2026–2027 para sa pagpapaunlad ng katatasan at pag-unawa sa Baitang 3.",
  },
];

export interface FilterDepEdCatalogOptions {
  gradeLevel: 1 | 2 | 3;
  categories?: InterventionCategory[];
  skillKeywords?: string[];
  catalog?: readonly DepEdResource[];
}

/**
 * Filter the DepEd LR Portal catalog by grade level, intervention categories, and optional
 * skill keywords before passing approved resource metadata to Gemini.
 */
export function filterDepEdResources(options: FilterDepEdCatalogOptions): DepEdResource[] {
  const sourceCatalog = options.catalog ?? DEPED_LR_CATALOG;
  const byGrade = sourceCatalog.filter((item) => item.gradeLevel === options.gradeLevel);

  const byCategory =
    options.categories && options.categories.length > 0
      ? byGrade.filter((item) => options.categories!.includes(item.category))
      : byGrade;

  if (!options.skillKeywords || options.skillKeywords.length === 0) {
    return byCategory;
  }

  const normalizedKeywords = options.skillKeywords
    .map((kw) => kw.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedKeywords.length === 0) {
    return byCategory;
  }

  const keywordMatched = byCategory.filter((item) => {
    const haystack = `${item.title} ${item.literacySkill} ${item.summary} ${item.applicableReadingLevel}`.toLowerCase();
    return normalizedKeywords.some((kw) => haystack.includes(kw));
  });

  return keywordMatched.length > 0 ? keywordMatched : byCategory;
}

/**
 * Build a human-readable, honest attribution label for an intervention activity's learning material.
 * Never claims AI-generated worksheets are official DepEd files and never fabricates URLs.
 */
export function buildResourceAttribution(
  kind: MaterialSourceAttribution,
  matchedResource?: DepEdResource | null,
  selectionReason?: string
): {
  kind: MaterialSourceAttribution;
  resourceId?: string;
  resourceTitle?: string;
  sourceUrl?: string;
  materialType?: string;
  selectionReason?: string;
  label: string;
} {
  if (matchedResource && (kind === "existing-deped-material" || kind === "ai-questions-from-deped-resource")) {
    const label =
      kind === "existing-deped-material"
        ? `Existing DepEd LR Portal Material: ${matchedResource.title}`
        : `AI-Generated Practice Questions Based on DepEd LR Portal Resource: ${matchedResource.title}`;

    return {
      kind,
      resourceId: matchedResource.id,
      resourceTitle: matchedResource.title,
      sourceUrl: DEPED_ARAL_LR_PORTAL_URL,
      materialType: matchedResource.materialType,
      selectionReason:
        selectionReason ||
        `Matched Grade ${matchedResource.gradeLevel} ${matchedResource.category} skill (${matchedResource.literacySkill}).`,
      label,
    };
  }

  return {
    kind: "ai-generated-supplementary",
    selectionReason:
      selectionReason ||
      "No matching DepEd LR Portal material was selected for this specific activity; generated grade-appropriate supplementary practice.",
    label: "AI-Generated Supplementary Material (Teacher Review Required — Not an Official DepEd File)",
  };
}

