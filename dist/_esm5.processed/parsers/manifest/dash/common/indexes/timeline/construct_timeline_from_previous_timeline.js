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
import log from "../../../../../../log";
import constructTimelineFromElements from "./construct_timeline_from_elements";
import convertElementToIndexSegment from "./convert_element_to_index_segment";
import findFirstCommonStartTime from "./find_first_common_start_time";
import parseSElement from "./parse_s_element";
export default function constructTimelineFromPreviousTimeline(newElements, prevTimeline, scaledPeriodStart) {
    var _a;
    // Find first index in both timeline where a common segment is found.
    var commonStartInfo = findFirstCommonStartTime(prevTimeline, newElements);
    if (commonStartInfo === null) {
        log.warn("DASH: Cannot perform \"based\" update. Common segment not found.");
        return constructTimelineFromElements(newElements, scaledPeriodStart);
    }
    var prevSegmentsIdx = commonStartInfo.prevSegmentsIdx, newElementsIdx = commonStartInfo.newElementsIdx, repeatNumberInPrevSegments = commonStartInfo.repeatNumberInPrevSegments, repeatNumberInNewElements = commonStartInfo.repeatNumberInNewElements;
    /** Guess of the number of elements in common. */
    var numberCommonEltGuess = prevTimeline.length - prevSegmentsIdx;
    var lastCommonEltNewEltsIdx = numberCommonEltGuess + newElementsIdx - 1;
    if (lastCommonEltNewEltsIdx >= newElements.length) {
        log.info("DASH: Cannot perform \"based\" update. New timeline too short");
        return constructTimelineFromElements(newElements, scaledPeriodStart);
    }
    // Remove elements which are not available anymore
    var newTimeline = prevTimeline.slice(prevSegmentsIdx);
    if (repeatNumberInPrevSegments > 0) {
        var commonEltInOldTimeline = newTimeline[0];
        commonEltInOldTimeline.start += commonEltInOldTimeline.duration *
            repeatNumberInPrevSegments;
        newTimeline[0].repeatCount -= repeatNumberInPrevSegments;
    }
    if (repeatNumberInNewElements > 0 && newElementsIdx !== 0) {
        log.info("DASH: Cannot perform \"based\" update. " +
            "The new timeline has a different form.");
        return constructTimelineFromElements(newElements, scaledPeriodStart);
    }
    var prevLastElement = newTimeline[newTimeline.length - 1];
    var newCommonElt = parseSElement(newElements[lastCommonEltNewEltsIdx]);
    var newRepeatCountOffseted = ((_a = newCommonElt.repeatCount) !== null && _a !== void 0 ? _a : 0) -
        repeatNumberInNewElements;
    if (newCommonElt.duration !== prevLastElement.duration ||
        prevLastElement.repeatCount > newRepeatCountOffseted) {
        log.info("DASH: Cannot perform \"based\" update. " +
            "The new timeline has a different form at the beginning.");
        return constructTimelineFromElements(newElements, scaledPeriodStart);
    }
    if (newCommonElt.repeatCount !== undefined &&
        newCommonElt.repeatCount > prevLastElement.repeatCount) {
        prevLastElement.repeatCount = newCommonElt.repeatCount;
    }
    var newEltsToPush = [];
    var items = [];
    for (var i = lastCommonEltNewEltsIdx + 1; i < newElements.length; i++) {
        items.push(parseSElement(newElements[i]));
    }
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var previousItem = newEltsToPush[newEltsToPush.length - 1] === undefined ?
            prevLastElement :
            newEltsToPush[newEltsToPush.length - 1];
        var nextItem = items[i + 1] === undefined ?
            null :
            items[i + 1];
        var timelineElement = convertElementToIndexSegment(item, previousItem, nextItem, scaledPeriodStart);
        if (timelineElement !== null) {
            newEltsToPush.push(timelineElement);
        }
    }
    return newTimeline.concat(newEltsToPush);
}
