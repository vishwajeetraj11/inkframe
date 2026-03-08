export interface ParsedCreatedaleyOpenerText {
  wordmark: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
}

export const CREATEDALEY_OPENER_DEFAULT_WORDMARK = "createdaley";
export const CREATEDALEY_OPENER_DEFAULT_PRONUNCIATION = "kree-a-tuh-day-lee";
export const CREATEDALEY_OPENER_DEFAULT_PART_OF_SPEECH = "noun";
export const CREATEDALEY_OPENER_DEFAULT_DEFINITION =
  "to inspire others to make, design, or imagine something new while reminding them to support the movement";

const splitOverlayLines = (text: string): string[] => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [text.trim()];
};

const normalizePronunciation = (value: string): string =>
  value.replace(/^\[+|\]+$/g, "").trim();

export const parseCreatedaleyOpenerText = (
  text: string,
): ParsedCreatedaleyOpenerText => {
  const lines = splitOverlayLines(text);
  const wordmark = lines[0] || CREATEDALEY_OPENER_DEFAULT_WORDMARK;
  const pronunciation = normalizePronunciation(
    lines[1] || CREATEDALEY_OPENER_DEFAULT_PRONUNCIATION,
  );
  const partOfSpeech = lines[2] || CREATEDALEY_OPENER_DEFAULT_PART_OF_SPEECH;
  const definition =
    lines.length > 3
      ? lines.slice(3).join(" ")
      : CREATEDALEY_OPENER_DEFAULT_DEFINITION;

  return {
    wordmark,
    pronunciation: pronunciation || CREATEDALEY_OPENER_DEFAULT_PRONUNCIATION,
    partOfSpeech: partOfSpeech || CREATEDALEY_OPENER_DEFAULT_PART_OF_SPEECH,
    definition: definition || CREATEDALEY_OPENER_DEFAULT_DEFINITION,
  };
};

export const buildCreatedaleyOpenerText = ({
  wordmark,
  pronunciation,
  partOfSpeech,
  definition,
}: ParsedCreatedaleyOpenerText): string =>
  [
    wordmark.trim() || CREATEDALEY_OPENER_DEFAULT_WORDMARK,
    normalizePronunciation(pronunciation) ||
      CREATEDALEY_OPENER_DEFAULT_PRONUNCIATION,
    partOfSpeech.trim() || CREATEDALEY_OPENER_DEFAULT_PART_OF_SPEECH,
    definition.trim() || CREATEDALEY_OPENER_DEFAULT_DEFINITION,
  ].join("\n");
