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
/**
 * Transform a Promise that can be cancelled (through the usage of a
 * `TaskCanceller`) to an Observable, while keeping the cancellation logic
 * between both in sync.
 *
 * @example
 * ```js
 * const canceller = new TaskCanceller();
 * fromCancellablePromise(
 *   canceller,
 *   () => doSomeCancellableTasks(canceller.signal)
 * ).subscribe(
 *   (i) => console.log("Emitted: ", i);
 *   (e) => console.log("Error: ", e);
 *   () => console.log("Complete.")
 * );
 * ```
 * @param {Object} canceller
 * @param {Function} fn
 * @returns {Observable}
 */
export default function fromCancellablePromise(canceller, fn) {
    return new Observable(function (obs) {
        var isUnsubscribedFrom = false;
        fn().then(function (i) {
            if (isUnsubscribedFrom) {
                return;
            }
            obs.next(i);
            obs.complete();
        }, function (err) {
            if (isUnsubscribedFrom) {
                return;
            }
            obs.error(err);
        });
        return function () {
            isUnsubscribedFrom = true;
            canceller.cancel();
        };
    });
}
