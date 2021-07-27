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
 * From 0 to N baseURL elements takes the minimum availabilityTimeOffset
 * possible.
 *
 * `0` if no baseURL was given (which means `no delay added`: coherent with how
 * this value is used).
 *
 * Taking the minimum time allow to simplify its processing:
 * Instead of having multiple URL each with a different pool of available
 * segment at a given instant, let's always consider every URLs by aligning with
 * the one with the most segment.
 *
 * @param {Array.<Object>} baseURLs
 */
export default function extractMinimumAvailabilityTimeOffset(baseURLs) {
    return baseURLs.length === 0 ?
        0 :
        baseURLs.reduce(function (acc, baseURL) {
            var _a;
            return Math.min((_a = baseURL.attributes.availabilityTimeOffset) !== null && _a !== void 0 ? _a : 0, acc);
        }, Infinity);
}
