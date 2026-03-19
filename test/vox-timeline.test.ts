import { describe, expect, it } from "vitest";
import {
  buildVoxTimelineText,
  parseVoxTimelineText,
} from "@/lib/editor/vox-timeline";

describe("vox timeline parser", () => {
  it("parses kicker, headline, and events including focus markers", () => {
    const parsed = parseVoxTimelineText(
      "HOW IT HAPPENED\nThe fall of the Berlin Wall\n1989|Protests spread|Demonstrations grow across East Germany.\nNov 9|Checkpoint opens|Border guards begin letting Berliners through.|focus\n1990|Germany reunifies|The Cold War map of Europe begins to change.",
    );

    expect(parsed.kicker).toBe("HOW IT HAPPENED");
    expect(parsed.headline).toBe("The fall of the Berlin Wall");
    expect(parsed.events).toHaveLength(3);
    expect(parsed.events[1]).toMatchObject({
      date: "Nov 9",
      title: "Checkpoint opens",
      emphasis: true,
    });
  });

  it("builds normalized timeline text with at least three events", () => {
    const built = buildVoxTimelineText({
      kicker: "HOW IT HAPPENED",
      headline: "Apollo 11",
      events: [
        {
          date: "1969",
          title: "Launch",
          caption: "Saturn V lifts off from Kennedy Space Center.",
          emphasis: false,
        },
      ],
    });

    const reparsed = parseVoxTimelineText(built);
    expect(reparsed.headline).toBe("Apollo 11");
    expect(reparsed.events.length).toBeGreaterThanOrEqual(3);
  });
});
