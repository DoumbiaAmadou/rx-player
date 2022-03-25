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
import config from "../../../config";
import areCodecsCompatible from "../../../utils/are_codecs_compatible";
import { convertToRanges, excludeFromRanges, isTimeInRange, isTimeInRanges, keepRangeIntersection, } from "../../../utils/ranges";
var ADAPTATION_SWITCH_BUFFER_PADDINGS = config.ADAPTATION_SWITCH_BUFFER_PADDINGS;
/**
 * Find out what to do when switching Adaptation, based on the current
 * situation.
 * @param {Object} segmentBuffer
 * @param {Object} period
 * @param {Object} adaptation
 * @param {Object} playbackInfo
 * @returns {Object}
 */
export default function getAdaptationSwitchStrategy(segmentBuffer, period, adaptation, playbackInfo, options) {
    if (segmentBuffer.codec !== undefined &&
        options.onCodecSwitch === "reload" &&
        !hasCompatibleCodec(adaptation, segmentBuffer.codec)) {
        return { type: "needs-reload", value: undefined };
    }
    var buffered = segmentBuffer.getBufferedRanges();
    if (buffered.length === 0) {
        return { type: "continue", value: undefined };
    }
    var bufferedRanges = convertToRanges(buffered);
    var start = period.start;
    var end = period.end == null ? Infinity :
        period.end;
    var intersection = keepRangeIntersection(bufferedRanges, [{ start: start, end: end }]);
    if (intersection.length === 0) {
        return { type: "continue", value: undefined };
    }
    segmentBuffer.synchronizeInventory();
    var inventory = segmentBuffer.getInventory();
    // Continue if we have no other Adaptation buffered in the current Period
    if (!inventory.some(function (buf) { return buf.infos.period.id === period.id &&
        buf.infos.adaptation.id !== adaptation.id; })) {
        return { type: "continue", value: undefined };
    }
    /** Data already in the right Adaptation */
    var adaptationInBuffer = getBufferedRangesFromAdaptation(inventory, period, adaptation);
    /**
     * Data different from the wanted Adaptation in the Period's range.
     * /!\ Could contain some data at the end of the previous Period or at the
     * beginning of the next one.
     */
    var unwantedRange = excludeFromRanges(intersection, adaptationInBuffer);
    if (unwantedRange.length === 0) {
        return { type: "continue", value: undefined };
    }
    var currentTime = playbackInfo.currentTime;
    if (adaptation.type === "video" &&
        // We're playing the current Period
        isTimeInRange({ start: start, end: end }, currentTime) &&
        // There is data for the current position or the codecs are differents
        (playbackInfo.readyState > 1 || !adaptation.getPlayableRepresentations()
            .some(function (rep) { var _a; return areCodecsCompatible(rep.getMimeTypeString(), (_a = segmentBuffer.codec) !== null && _a !== void 0 ? _a : ""); })) &&
        // We're not playing the current wanted video Adaptation
        !isTimeInRanges(adaptationInBuffer, currentTime)) {
        return { type: "needs-reload", value: undefined };
    }
    // From here, clean-up data from the previous Adaptation, if one
    var shouldFlush = adaptation.type === "audio" &&
        options.audioTrackSwitchingMode === "direct";
    var rangesToExclude = [];
    // First, we don't want to accidentally remove some segments from the previous
    // Period (which overlap a little with this one)
    /** Last segment before one for the current period. */
    var lastSegmentBefore = getLastSegmentBeforePeriod(inventory, period);
    if (lastSegmentBefore !== null &&
        (lastSegmentBefore.bufferedEnd === undefined ||
            period.start - lastSegmentBefore.bufferedEnd < 1)) // Close to Period's start
     {
        // Exclude data close to the period's start to avoid cleaning
        // to much
        rangesToExclude.push({ start: 0,
            end: period.start + 1 });
    }
    // Next, exclude data around current position to avoid decoding issues
    var bufferType = adaptation.type;
    /** Ranges that won't be cleaned from the current buffer. */
    var paddingBefore = ADAPTATION_SWITCH_BUFFER_PADDINGS[bufferType].before;
    if (paddingBefore == null) {
        paddingBefore = 0;
    }
    var paddingAfter = ADAPTATION_SWITCH_BUFFER_PADDINGS[bufferType].after;
    if (paddingAfter == null) {
        paddingAfter = 0;
    }
    if (!shouldFlush) {
        rangesToExclude.push({ start: currentTime - paddingBefore,
            end: currentTime + paddingAfter });
    }
    // Now remove possible small range from the end if there is a segment from the
    // next Period
    if (period.end !== undefined) {
        /** first segment after for the current period. */
        var firstSegmentAfter = getFirstSegmentAfterPeriod(inventory, period);
        if (firstSegmentAfter !== null &&
            (firstSegmentAfter.bufferedStart === undefined ||
                (firstSegmentAfter.bufferedStart - period.end) < 1)) // Close to Period's end
         {
            rangesToExclude.push({ start: period.end - 1,
                end: Number.MAX_VALUE });
        }
    }
    var toRemove = excludeFromRanges(unwantedRange, rangesToExclude);
    if (toRemove.length === 0) {
        return { type: "continue", value: undefined };
    }
    return shouldFlush ? { type: "flush-buffer", value: toRemove } :
        { type: "clean-buffer", value: toRemove };
}
/**
 * Returns `true` if at least one codec of the Representations in the given
 * Adaptation has a codec compatible with the given SegmentBuffer's codec.
 * @param {Object} adaptation
 * @param {string} segmentBufferCodec
 * @returns {boolean}
 */
function hasCompatibleCodec(adaptation, segmentBufferCodec) {
    return adaptation.getPlayableRepresentations().some(function (rep) {
        return areCodecsCompatible(rep.getMimeTypeString(), segmentBufferCodec);
    });
}
/**
 * Returns buffered ranges of what we know correspond to the given `adaptation`
 * in the SegmentBuffer.
 * @param {Object} segmentBuffer
 * @param {Object} period
 * @param {Object} adaptation
 * @returns {Array.<Object>}
 */
function getBufferedRangesFromAdaptation(inventory, period, adaptation) {
    return inventory.reduce(function (acc, chunk) {
        if (chunk.infos.period.id !== period.id ||
            chunk.infos.adaptation.id !== adaptation.id) {
            return acc;
        }
        var bufferedStart = chunk.bufferedStart, bufferedEnd = chunk.bufferedEnd;
        if (bufferedStart === undefined || bufferedEnd === undefined) {
            return acc;
        }
        acc.push({ start: bufferedStart, end: bufferedEnd });
        return acc;
    }, []);
}
/**
 * Returns the last segment in the `inventory` which is linked to a Period
 * before `period`.
 * @param {Array.<Object>} inventory
 * @param {Object} period
 * @returns {Object|null}
 */
function getLastSegmentBeforePeriod(inventory, period) {
    for (var i = 0; i < inventory.length; i++) {
        if (inventory[i].infos.period.start >= period.start) {
            if (i > 0) {
                return inventory[i - 1];
            }
            return null;
        }
    }
    return inventory.length > 0 ? inventory[inventory.length - 1] :
        null;
}
/**
 * Returns the first segment in the `inventory` which is linked to a Period
 * after `period`.
 * @param {Array.<Object>} inventory
 * @param {Object} period
 * @returns {Object|null}
 */
function getFirstSegmentAfterPeriod(inventory, period) {
    for (var i = 0; i < inventory.length; i++) {
        if (inventory[i].infos.period.start > period.start) {
            return inventory[i];
        }
    }
    return null;
}
