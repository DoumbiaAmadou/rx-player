/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import log from "../../../log";
import Manifest, {
  Adaptation,
  Period,
  Representation,
} from "../../../manifest";
import { IBufferedChunk } from "../../segment_buffers";
import { IBufferDiscontinuity } from "../types";

/**
 * Check if there is a soon-to-be-encountered discontinuity in the buffer that
 * won't be filled by any future segment.
 * This function will only check discontinuities for the given `checkedRange`.
 *
 * @param {Object} content - The content we are currently loading.
 * @param {Object} checkedRange - The time range that will be checked for
 * discontinuities.
 * Both `nextSegmentStart` and `bufferedSegments` arguments can only refer to
 * that range.
 * @param {number|null} nextSegmentStart - The start time in seconds of the next
 * not-yet-pushed segment that can be pushed, in the limits of `checkedRange`.
 * This includes segments which have not been loaded or pushed yet, but also
 * segments which might be re-downloaded because currently incomplete in the
 * buffer, the point being to know what is the earliest time in the buffer where
 * a segment might be pushed in the future.
 * `null` if no segment in `checkedRange` will be pushed under current buffer's
 * conditions.
 * @param {boolean} hasFinishedLoading - if `true`, all segments for the current
 * Period have been loaded and none will be loaded in the future under the
 * current buffer's state.
 * @param {Array.<Object>} bufferedSegments - Information about every segments
 * currently in the buffer, in chronological order.
 * Only segments overlapping with the given `checkedRange` will be looked at,
 * though the array given can be larger.
 */
export default function checkForDiscontinuity(
  content : { adaptation : Adaptation;
              manifest : Manifest;
              period : Period;
              representation : Representation; },
  checkedRange : { start : number; end : number },
  nextSegmentStart : number | null,
  hasFinishedLoading : boolean,
  bufferedSegments : IBufferedChunk[]
) : IBufferDiscontinuity | null {
  const { period, adaptation, representation } = content;

  // `bufferedSegments` might also contains segments which are before
  // `checkedRange`.
  // Here we want the first one that goes over `checkedRange.start`, to  see
  // if there's a discontinuity at the beginning in the buffer
  let nextBufferedInRangeIdx;
  for (let bufIdx = 0; bufIdx < bufferedSegments.length; bufIdx++) {
    const bufSeg = bufferedSegments[bufIdx];
    if (bufSeg.bufferedStart === undefined ||
        bufSeg.bufferedEnd === undefined ||
        bufSeg.bufferedStart >= checkedRange.end)
    {
      break;
    }
    if (bufSeg.bufferedEnd > checkedRange.start) {
      nextBufferedInRangeIdx = bufIdx;
      break;
    }
  }

  if (nextBufferedInRangeIdx === undefined) {
    // There's no segment currently buffered for the current range.

    if (nextSegmentStart === null) { // No segment to load in that range
      // Check if we are in a discontinuity at the end of the current Period
      if (hasFinishedLoading &&
          period.end !== undefined &&
          checkedRange.end >= period.end)
      {
        return { start: undefined, end: null }; // discontinuity to Period's end
      }

      // Check that there is a discontinuity anounced in the Manifest there
      const discontinuityEnd = representation.index
        .checkDiscontinuity(checkedRange.start);
      if (discontinuityEnd !== null) {
        return { start: undefined,
                 end: discontinuityEnd };
      }
    }
    return null;
  }

  const nextBufferedSegment = bufferedSegments[nextBufferedInRangeIdx];

  // Check if there is a hole that won't be filled before `nextSegmentStart`
  if (
    // Next buffered segment starts after the start of the current range
    nextBufferedSegment.bufferedStart !== undefined &&
    nextBufferedSegment.bufferedStart > checkedRange.start &&

    // and no segment will fill in that hole
    (nextSegmentStart === null ||
     nextBufferedSegment.infos.segment.end <= nextSegmentStart)
  ) {
    log.error("RS: current discontinuity encountered",
              adaptation.type, nextBufferedSegment.bufferedStart);
    return { start: undefined,
             end: nextBufferedSegment.bufferedStart };
  }

  // Check if there's a discontinuity BETWEEN segments of the current range
  let nextHoleIdx;
  for (
    let bufIdx = nextBufferedInRangeIdx + 1;
    bufIdx < bufferedSegments.length;
    bufIdx++)
  {
    const currSegment = bufferedSegments[bufIdx];
    const prevSegment = bufferedSegments[bufIdx - 1];

    // Exit as soon we miss information or when we go further than `checkedRange`
    if (currSegment.bufferedStart === undefined ||
        prevSegment.bufferedEnd === undefined ||
        currSegment.bufferedStart >= checkedRange.end)
    {
      break;
    }

    // If there is a hole between two consecutive buffered segment
    if (currSegment.bufferedStart - prevSegment.bufferedEnd > 0) {
      nextHoleIdx = bufIdx;
      break;
    }
  }

  // If there was a hole between two consecutives segments, and ifh this hole
  // comes before the next segment to load, there is a discontinuity (that hole!)
  if (nextHoleIdx !== undefined &&
      (nextSegmentStart === null ||
       bufferedSegments[nextHoleIdx].infos.segment.end <= nextSegmentStart))
  {
    const start = bufferedSegments[nextHoleIdx - 1].bufferedEnd as number;
    const end = bufferedSegments[nextHoleIdx].bufferedStart as number;
    log.error("RS: future discontinuity encountered", adaptation.type, start, end);
    return { start, end };

  } else if (nextSegmentStart === null) {
    // If no hole between segments and no segment to load, check for a
    // discontinuity at the end of the Period

    if (hasFinishedLoading && period.end !== undefined) { // Period is finished
      if (checkedRange.end < period.end) { // We've not reached the Period's end yet
        return null;
      }

      // Check if the last buffered segment ends before this Period's end
      // In which case there is a discontinuity between those
      let lastBufferedInPeriodIdx;
      for (let bufIdx = bufferedSegments.length - 1; bufIdx >= 0; bufIdx--) {
        const bufSeg = bufferedSegments[bufIdx];
        if (bufSeg.bufferedStart === undefined) {
          break;
        }
        if (bufSeg.bufferedStart < period.end) {
          lastBufferedInPeriodIdx = bufIdx;
          break;
        }
      }
      if (lastBufferedInPeriodIdx !== undefined) {
        const lastSegment = bufferedSegments[lastBufferedInPeriodIdx];
        if (lastSegment.bufferedEnd !== undefined &&
            lastSegment.bufferedEnd < period.end)
        {
          log.error("RS: discontinuity encountered at the end of the current period",
                    adaptation.type, lastSegment.bufferedEnd, period.end);
          return { start: lastSegment.bufferedEnd,
                   end: null };
        }
      }
    }

    // At last, check if we don't have a discontinuity at the end of the current
    // Period, anounced in the Manifest, that is too big to be detected through
    // the previous checks (when the Period's end goes further than `checkedRange`).

    if (period.end !== undefined && checkedRange.end >= period.end) {
      return null; // The previous checks should have taken care of those
    }

    for (let bufIdx = bufferedSegments.length - 1; bufIdx >= 0; bufIdx--) {
      const bufSeg = bufferedSegments[bufIdx];
      if (bufSeg.bufferedStart === undefined) {
        break;
      }

      if (bufSeg.bufferedStart < checkedRange.end) {
        if (bufSeg.bufferedEnd !== undefined && bufSeg.bufferedEnd < checkedRange.end) {
          const discontinuityEnd = representation.index
            .checkDiscontinuity(checkedRange.end);
          if (discontinuityEnd !== null) {
            return { start: bufSeg.bufferedEnd,
                     end: discontinuityEnd };
          }
        }
        return null;
      }
    }
  }
  return null;
}