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
import log from "../../log";
import EWMA from "./ewma";
/**
 * Calculate the "maintainability score" of a given Representation:
 *   - A score higher than 1 means that the Representation can theorically
 *     be downloaded faster than the duration of the media it represents.
 *     (e.g. a segment representing 4 seconds can be downloaded in less than 4
 *     seconds).
 *   - A score lower or equal to 1 means that the Representation cannot be
 *     downloaded
 *
 * The score follows a simple linear relation to both variables it is based
 * on:
 *   - if n seconds of content can be downloaded in 2*n seconds, the score will
 *     be `0.5`.
 *   - if n seconds of content can be downloaded in n seconds, the score will be
 *     `1`.
 *   - if n seconds of content can be downloaded in n/2 seconds, the score will
 *     be `2`.
 *   - ...
 *
 * The score is mainly here to tell you when your buffer-based guesses are
 * actually higher than the quality you should normally reach.
 *
 * /!\ Please bear in mind that we don't consider the playback rate in those
 * operations.
 * Still, integrating the playback rate a posteriori should not be difficult
 * (e.g. you can just divide the score by that rate).
 *
 * @class RepresentationScoreCalculator
 */
var RepresentationScoreCalculator = /** @class */ (function () {
    function RepresentationScoreCalculator() {
        this._currentRepresentationData = null;
        this._lastRepresentationWithGoodScore = null;
    }
    /**
     * Add new sample data.
     * @param {Representation} representation
     * @param {number} requestDuration - duration taken for doing the request for
     * the whole segment.
     * @param {number} segmentDuration - media duration of the whole segment, in
     * seconds.
     */
    RepresentationScoreCalculator.prototype.addSample = function (representation, requestDuration, segmentDuration) {
        var ratio = segmentDuration / requestDuration;
        var oldEwma = this._getEWMA(representation);
        var currentEWMA;
        if (oldEwma != null) {
            currentEWMA = oldEwma;
            oldEwma.addSample(requestDuration, ratio);
        }
        else {
            currentEWMA = new EWMA(5);
            currentEWMA.addSample(requestDuration, ratio);
            this._currentRepresentationData = { representation: representation, ewma: currentEWMA };
        }
        if (currentEWMA.getEstimate() > 1 &&
            this._lastRepresentationWithGoodScore !== representation) {
            log.debug("ABR: New last stable representation", representation);
            this._lastRepresentationWithGoodScore = representation;
        }
    };
    /**
     * Get score estimate for the given Representation.
     * undefined if no estimate is available.
     * @param {Representation} representation
     * @returns {number|undefined}
     */
    RepresentationScoreCalculator.prototype.getEstimate = function (representation) {
        var ewma = this._getEWMA(representation);
        if (ewma != null) {
            return ewma.getEstimate();
        }
    };
    /**
     * Returns last Representation which had reached a score superior to 1.
     * This Representation is the last known one which could be maintained.
     * Useful to know if a current guess is higher than what you should
     * normally be able to play.
     * `null` if no Representation ever reach that score.
     * @returns {Representation|null}
     */
    RepresentationScoreCalculator.prototype.getLastStableRepresentation = function () {
        return this._lastRepresentationWithGoodScore;
    };
    /**
     * Returns EWMA for the given Representation.
     * null if no EWMA is currently stored for it.
     * @param {Representation} representation
     * @returns {EWMA|null}
     */
    RepresentationScoreCalculator.prototype._getEWMA = function (representation) {
        if (this._currentRepresentationData != null &&
            this._currentRepresentationData.representation.id === representation.id) {
            return this._currentRepresentationData.ewma;
        }
        return null;
    };
    return RepresentationScoreCalculator;
}());
export default RepresentationScoreCalculator;
