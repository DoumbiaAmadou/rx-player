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
import { Observable } from "rxjs";
import { IRepresentation } from "../../manifest";
import { ISharedReference } from "../../utils/reference";
import { IBufferType } from "../segment_buffers";
import { IABREstimate, IABRStreamEvents, IRepresentationEstimatorPlaybackObservation } from "./representation_estimator";
export declare type IABRManagerPlaybackObservation = IRepresentationEstimatorPlaybackObservation;
interface IRepresentationEstimatorsThrottlers {
    limitWidth: Partial<Record<IBufferType, Observable<number>>>;
    throttle: Partial<Record<IBufferType, Observable<number>>>;
    throttleBitrate: Partial<Record<IBufferType, Observable<number>>>;
}
export interface IABRManagerArguments {
    initialBitrates: Partial<Record<IBufferType, // Initial bitrate chosen, per
    number>>;
    lowLatencyMode: boolean;
    /** Minimum bitrate chosen when in auto mode, per type (0 by default) */
    minAutoBitrates: Partial<Record<IBufferType, ISharedReference<number>>>;
    /** Maximum bitrate chosen when in auto mode, per type (0 by default) */
    maxAutoBitrates: Partial<Record<IBufferType, ISharedReference<number>>>;
    /** Manually forced bitrate set for a given type (`-1` for auto mode */
    manualBitrates: Partial<Record<IBufferType, ISharedReference<number>>>;
    throttlers: IRepresentationEstimatorsThrottlers;
}
/**
 * Adaptive BitRate Manager.
 *
 * Select the right Representation from the network and buffer infos it
 * receives.
 * @class ABRManager
 */
export default class ABRManager {
    private _bandwidthEstimators;
    private _initialBitrates;
    private _manualBitrates;
    private _minAutoBitrates;
    private _maxAutoBitrates;
    private _throttlers;
    private _lowLatencyMode;
    /**
     * @param {Object} options
     */
    constructor(options: IABRManagerArguments);
    /**
     * Take type and an array of the available representations, spit out an
     * observable emitting the best representation (given the network/buffer
     * state).
     * @param {string} type
     * @param {Array.<Object>} representations
     * @param {Observable<Object>} observation$
     * @param {Observable<Object>} streamEvents$
     * @returns {Observable}
     */
    get$(type: IBufferType, representations: IRepresentation[], observation$: Observable<IABRManagerPlaybackObservation>, streamEvents$: Observable<IABRStreamEvents>): Observable<IABREstimate>;
    /**
     * @param {string} bufferType
     * @returns {Object}
     */
    private _getBandwidthEstimator;
}
export {};
