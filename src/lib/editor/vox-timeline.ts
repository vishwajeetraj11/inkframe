export interface VoxTimelineEvent {
  date: string;
  title: string;
  caption: string;
  emphasis: boolean;
}

export interface ParsedVoxTimelineText {
  kicker: string;
  headline: string;
  events: VoxTimelineEvent[];
}

export const VOX_TIMELINE_DEFAULT_KICKER = "HOW IT HAPPENED";
export const VOX_TIMELINE_DEFAULT_HEADLINE = "The fall of the Berlin Wall";
export const VOX_TIMELINE_FALLBACK_EVENTS: VoxTimelineEvent[] = [
  {
    date: "1989",
    title: "Protests spread",
    caption: "Demonstrations grow across East Germany.",
    emphasis: false,
  },
  {
    date: "Nov 9",
    title: "Press conference",
    caption: "A botched announcement sets crowds in motion.",
    emphasis: false,
  },
  {
    date: "Nov 9",
    title: "Checkpoint opens",
    caption: "Border guards begin letting Berliners through.",
    emphasis: true,
  },
  {
    date: "Nov 10",
    title: "Wall breached",
    caption: "People climb the wall and start chipping it apart.",
    emphasis: false,
  },
  {
    date: "1990",
    title: "Germany reunifies",
    caption: "The Cold War map of Europe begins to change.",
    emphasis: false,
  },
] as const;

const splitOverlayLines = (text: string): string[] => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.length > 0 ? lines : [text.trim()];
};

const isFocusToken = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "focus" ||
    normalized === "highlight" ||
    normalized === "emphasis" ||
    normalized === "true" ||
    normalized === "1"
  );
};

const normalizeEvent = (
  event: Partial<VoxTimelineEvent>,
  fallback: VoxTimelineEvent,
): VoxTimelineEvent => ({
  date: event.date?.trim() || fallback.date,
  title: event.title?.trim() || fallback.title,
  caption: event.caption?.trim() || fallback.caption,
  emphasis: Boolean(event.emphasis),
});

const normalizeEvents = (
  events: Partial<VoxTimelineEvent>[],
): VoxTimelineEvent[] => {
  const normalized = events
    .map((event, index) =>
      normalizeEvent(
        event,
        VOX_TIMELINE_FALLBACK_EVENTS[
          Math.min(index, VOX_TIMELINE_FALLBACK_EVENTS.length - 1)
        ],
      ),
    )
    .filter(
      (event) =>
        event.date.length > 0 && event.title.length > 0 && event.caption.length > 0,
    )
    .slice(0, 6);

  if (normalized.length >= 3) {
    return normalized;
  }

  return VOX_TIMELINE_FALLBACK_EVENTS.map((event) => ({ ...event }));
};

export const parseVoxTimelineText = (
  text: string,
): ParsedVoxTimelineText => {
  const lines = splitOverlayLines(text);
  const kicker = lines[0] || VOX_TIMELINE_DEFAULT_KICKER;
  const headline = lines[1] || VOX_TIMELINE_DEFAULT_HEADLINE;
  const events = normalizeEvents(
    lines.slice(2).map((line) => {
      const [date = "", title = "", caption = "", focus = ""] = line
        .split("|")
        .map((part) => part.trim());

      return {
        date,
        title,
        caption,
        emphasis: isFocusToken(focus),
      } satisfies Partial<VoxTimelineEvent>;
    }),
  );

  return {
    kicker: kicker || VOX_TIMELINE_DEFAULT_KICKER,
    headline: headline || VOX_TIMELINE_DEFAULT_HEADLINE,
    events,
  };
};

export const buildVoxTimelineText = ({
  kicker,
  headline,
  events,
}: ParsedVoxTimelineText): string => {
  const safeEvents = normalizeEvents(events);

  return [
    kicker.trim() || VOX_TIMELINE_DEFAULT_KICKER,
    headline.trim() || VOX_TIMELINE_DEFAULT_HEADLINE,
    ...safeEvents.map((event) =>
      [
        event.date.trim(),
        event.title.trim(),
        event.caption.trim(),
        event.emphasis ? "focus" : "",
      ]
        .filter((part) => part.length > 0)
        .join("|"),
    ),
  ].join("\n");
};
