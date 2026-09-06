import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("confirmed decoder end-of-stream", () => {
  it("flushes delayed terminal frames once, ignores later EOF feeds, and resets on seek", async () => {
    const backendSource = readFileSync("node_modules/@elah/core/dist/media/video/demuxer/createMediabunnyBackend.js", "utf8").replaceAll("export function", "function");
    const createBackend = new Function(`${backendSource}; return createMediabunnyBackend;`)();
    const demuxerSource = readFileSync("node_modules/@elah/core/dist/media/video/demuxer/MediabunnyDemuxer.js", "utf8").replace("export class", "class");
    const Demuxer = new Function(`${demuxerSource}; return MediabunnyDemuxer;`)();
    const managerSource = readFileSync("node_modules/@elah/core/dist/media/video/VideoDecoderManager.js", "utf8");
    const managerBody = managerSource.slice(managerSource.indexOf("const DEFAULT_IDLE_TIMEOUT_MS")).replace("export class", "class");
    const Manager = new Function("MediabunnyDemuxer", `${managerBody}; return VideoDecoderManager;`)(Demuxer);
    const packets = [0, 33333, 66667].map(timestamp => ({ timestamp: timestamp / 1e6, toEncodedVideoChunk: () => ({ timestamp }) }));
    const mb = {
      ALL_FORMATS: [], BlobSource: class {},
      Input: class { async getPrimaryVideoTrack() { return { getDecoderConfig: async () => ({ codec: "avc1" }) }; } },
      EncodedPacketSink: class {
        async getKeyPacket() { return packets[0]; }
        async getNextPacket(packet: typeof packets[number]) { return packets[packets.indexOf(packet) + 1] ?? null; }
      },
    };
    let flushes = 0;
    let decodes = 0;
    const emitted: number[] = [];
    const manager = new Manager({ demuxerFactory: () => createBackend(mb, { blobResolver: async () => new Blob() }), decoderFactory: (output: (frame: { timestamp: number; close(): void }) => void) => {
      let delayed: number[] = [];
      return { configure() {}, reset() { delayed = []; }, decodeQueueSize: 0,
        decode(chunk: { timestamp: number }) { delayed.push(chunk.timestamp); decodes++; },
        async flush() { flushes++; for (const timestamp of delayed) output({ timestamp, close() {} }); delayed = []; },
      };
    } });
    manager.onFrame = (frame: { timestamp: number }) => emitted.push(frame.timestamp);
    await manager.open("blob:fixture");
    await manager._feedAsync([0, 50000], manager._feedGeneration);
    expect(flushes).toBe(0);
    expect(emitted).toEqual([]);
    await manager._feedAsync([50000, 100000], manager._feedGeneration);
    expect(flushes).toBe(1);
    expect(emitted).toEqual([0, 33333, 66667]);
    expect(manager._demuxer.isAtEnd).toBe(true);
    manager.feed([100000, 200000]);
    await manager._feedAsync([100000, 200000], manager._feedGeneration);
    expect(decodes).toBe(3);
    expect(flushes).toBe(1);
    await manager.reset(0);
    expect(manager._demuxer.isAtEnd).toBe(false);
    await manager._feedAsync([0, 100000], manager._feedGeneration);
    expect(flushes).toBe(2);
    expect(emitted).toEqual([0, 33333, 66667, 0, 33333, 66667]);
  });
});
