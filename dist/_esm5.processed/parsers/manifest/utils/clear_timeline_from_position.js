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
/**
 * Remove segments which starts before the given `firstAvailablePosition` from
 * the timeline. `firstAvailablePosition` has to be time scaled.
 * @param {Array.<Object>}
 * @returns {number}
 */
export default function clearTimelineFromPosition(timeline, firstAvailablePosition) {
    while (timeline.length > 0) {
        var firstElt = timeline[0];
        if (firstElt.start >= firstAvailablePosition) {
            return; // all clear
        }
        if (firstElt.repeatCount <= 0) {
            timeline.shift();
        }
        else { // we have a segment repetition
            var nextElt = timeline[1];
            if (nextElt !== undefined && nextElt.start <= firstAvailablePosition) {
                timeline.shift();
            }
            else { // no next segment or next segment is available
                if (firstElt.duration <= 0) {
                    return;
                }
                var nextStart = firstElt.start + firstElt.duration;
                var nextRepeat = 1;
                while (nextStart < firstAvailablePosition &&
                    nextRepeat <= firstElt.repeatCount) {
                    nextStart += firstElt.duration;
                    nextRepeat++;
                }
                if (nextRepeat > firstElt.repeatCount) { // every start is before
                    timeline.shift();
                }
                else { // some repetitions start after and some before
                    var newRepeat = firstElt.repeatCount - nextRepeat;
                    firstElt.start = nextStart;
                    firstElt.repeatCount = newRepeat;
                    return;
                }
            }
        }
    }
}
