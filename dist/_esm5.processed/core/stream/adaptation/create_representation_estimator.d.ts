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
import { Observable, Subject } from "rxjs";
import Manifest, { Adaptation } from "../../../manifest";
import ABRManager, { IABREstimate, IABRManagerPlaybackObservation, IABRStreamEvents } from "../../abr";
/**
 * Create an "estimator$" Observable which will emit which Representation (from
 * the given `Adaptation`) is the best fit (see `IABREstimate` type definition)
 * corresponding to the current network and playback conditions.
 *
 * This function also returns a subject that should be used to add feedback
 * helping the estimator to make its choices.
 *
 * You can look at the types defined for this Subject to have more information
 * on what data is expected. The idea is to provide as much data as possible so
 * the estimation is as adapted as possible.
 *
 * @param {Object} content
 * @param {Object} abrManager
 * @param {Observable} observation$
 * @returns {Object}
 */
export default function createRepresentationEstimator({ manifest, adaptation }: {
    manifest: Manifest;
    adaptation: Adaptation;
}, abrManager: ABRManager, observation$: Observable<IABRManagerPlaybackObservation>): {
    estimator$: Observable<IABREstimate>;
    abrFeedbacks$: Subject<IABRStreamEvents>;
};