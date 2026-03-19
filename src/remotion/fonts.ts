import { loadFont as loadBarlowCondensed } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadCormorantGaramond } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadIBMPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadPlusJakartaSans } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadSourceSerif4 } from "@remotion/google-fonts/SourceSerif4";

const quoteFontFamily = (fontFamily: string): string =>
  fontFamily.includes(" ") ? `"${fontFamily}"` : fontFamily;

const plusJakartaSans = loadPlusJakartaSans("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});
const sora = loadSora("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});
const ibmPlexMono = loadIBMPlexMono("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});
const sourceSerif4 = loadSourceSerif4("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

loadSourceSerif4("italic", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

const cormorantGaramond = loadCormorantGaramond("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

loadCormorantGaramond("italic", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const barlowCondensed = loadBarlowCondensed("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const REMOTION_FONT_FAMILIES = {
  barlowCondensed: barlowCondensed.fontFamily,
  cormorantGaramond: cormorantGaramond.fontFamily,
  ibmPlexMono: ibmPlexMono.fontFamily,
  plusJakartaSans: plusJakartaSans.fontFamily,
  sora: sora.fontFamily,
  sourceSerif4: sourceSerif4.fontFamily,
} as const;

export const REMOTION_FONT_STACKS = {
  condensed: `${quoteFontFamily(REMOTION_FONT_FAMILIES.barlowCondensed)}, ${quoteFontFamily(REMOTION_FONT_FAMILIES.sora)}, Arial, sans-serif`,
  display: `${quoteFontFamily(REMOTION_FONT_FAMILIES.sora)}, ${quoteFontFamily(REMOTION_FONT_FAMILIES.plusJakartaSans)}, Arial, sans-serif`,
  editorialSerif: `${quoteFontFamily(REMOTION_FONT_FAMILIES.cormorantGaramond)}, ${quoteFontFamily(REMOTION_FONT_FAMILIES.sourceSerif4)}, Georgia, serif`,
  mono: `${quoteFontFamily(REMOTION_FONT_FAMILIES.ibmPlexMono)}, "Courier New", monospace`,
  sans: `${quoteFontFamily(REMOTION_FONT_FAMILIES.plusJakartaSans)}, Arial, sans-serif`,
  serif: `${quoteFontFamily(REMOTION_FONT_FAMILIES.sourceSerif4)}, Georgia, serif`,
  statRingHeadline: `${quoteFontFamily(REMOTION_FONT_FAMILIES.sourceSerif4)}, Georgia, serif`,
  statRingNumber: `${quoteFontFamily(REMOTION_FONT_FAMILIES.cormorantGaramond)}, ${quoteFontFamily(REMOTION_FONT_FAMILIES.sourceSerif4)}, Georgia, serif`,
} as const;
