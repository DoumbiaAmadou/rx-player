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
import Manifest from "../../manifest";
import { IStreamOrchestratorClockTick } from "../stream";
import { IInitClockTick } from "./types";
export interface IStreamClockArguments {
    autoPlay: boolean;
    initialPlay$: Observable<unknown>;
    initialSeek$: Observable<unknown>;
    manifest: Manifest;
    speed$: Observable<number>;
    startTime: number;
}
/**
 * Create clock Observable for the `Stream` part of the code.
 * @param {Observable} initClock$
 * @param {Object} streamClockArgument
 * @returns {Observable}
 */
export default function createStreamClock(initClock$: Observable<IInitClockTick>, { autoPlay, initialPlay$, initialSeek$, manifest, speed$, startTime }: IStreamClockArguments): Observable<IStreamOrchestratorClockTick>;
