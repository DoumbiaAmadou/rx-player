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

import {
  merge as observableMerge,
  Observable,
  Subject,
} from "rxjs";
import { switchMap } from "rxjs/operators";
import { MediaError } from "../../../errors";
import Manifest, {
  Adaptation,
  Period,
  Representation,
} from "../../../manifest";
import RepresentationPickerController, {
  IABREstimate,
  IRepresentationPickerClockTick,
  IABRMetricsEvent,
  IABRRequestBeginEvent,
  IABRRequestEndEvent,
  IABRRequestProgressEvent,
} from "../../abr";
import RepresentationPicker from "../../abr/representation_picker";
import {
  IRepresentationChangeEvent,
  IStreamEventAddedSegment,
} from "../types";

/**
 * Create an "estimator$" Observable which will emit which Representation (from
 * the given `Adaptation`) is the best fit (see `IABREstimate` type definition)
 * corresponding to the current network and playback conditions.
 *
 * This function also returns two subjects that should be used to add feedback
 * helping the estimator to make its choices:
 *
 *   - `requestFeedback$`: Subject through which information about new requests
 *     and network metrics should be emitted.
 *
 *   - `streamFeedback$`: Subject through which stream-related events should be
 *      emitted.
 *
 * You can look at the types defined for both of those Subjects to have more
 * information on what data is expected. The idea is to provide as much data as
 * possible so the estimation is as adapted as possible.
 *
 * @param {Object} content
 * @param {Object} representationPickerCtrl
 * @param {Observable} clock$
 * @returns {Object}
 */
export default function createRepresentationEstimator(
  contentInfos : { manifest : Manifest;
                   period : Period;
                   adaptation : Adaptation; },
  representationPickerCtrl : RepresentationPickerController,
  clock$ : Observable<IRepresentationPickerClockTick>
) : { estimator$ : Observable<IABREstimate>;
      streamFeedback$ : Subject<IStreamEventAddedSegment<unknown> |
                                IRepresentationChangeEvent>;
      requestFeedback$ : Subject<IABRMetricsEvent |
                                 IABRRequestBeginEvent |
                                 IABRRequestProgressEvent |
                                 IABRRequestEndEvent>; }
{
  const streamFeedback$ = new Subject<IStreamEventAddedSegment<unknown> |
                                      IRepresentationChangeEvent>();
  const requestFeedback$ = new Subject<IABRMetricsEvent |
                                       IABRRequestBeginEvent |
                                       IABRRequestProgressEvent |
                                       IABRRequestEndEvent>();
  const abrEvents$ = observableMerge(streamFeedback$, requestFeedback$);

  const picker$ = getRepresentationPicker$(representationPickerCtrl, contentInfos);
  const estimator$ = picker$.pipe(
    switchMap((picker) => picker.start$(clock$, abrEvents$)));

  return { estimator$,
           streamFeedback$,
           requestFeedback$ };
}

/**
 * Emit a new RepresentationPicker on Subscription and each time the list of
 * playable Representations changes.
 * @param {Object} representationPickerCtrl
 * @param {Object} contentInfos
 * @returns {Observable.<Object>}
 */
function getRepresentationPicker$(
  representationPickerCtrl : RepresentationPickerController,
  contentInfos : { manifest : Manifest;
                   period : Period;
                   adaptation : Adaptation; }
) : Observable<RepresentationPicker> {
  return new Observable((obs) => {
    const { manifest, period, adaptation } = contentInfos;

    /** Representations for which a `RepresentationStream` can be created. */
    const playableRepresentations = getPlayableRepresentations(adaptation);

    const initialPicker = representationPickerCtrl
      .registerPicker({ period, bufferType: adaptation.type },
                      playableRepresentations);

    obs.next(initialPicker);
    let currentRepresentations = playableRepresentations;

    manifest.addEventListener("decipherabilityUpdate", onDecipherabilityUpdate);

    function onDecipherabilityUpdate() {
      const newRepresentations = getPlayableRepresentations(adaptation);
      if (newRepresentations.length !== currentRepresentations.length) {
        let isDifferent = false;
        for (let i = 0; i < newRepresentations.length; i++) {
          if (newRepresentations[i].id !== currentRepresentations[i].id) {
            isDifferent = true;
          }
        }
        if (!isDifferent) {
          return;
        }
      }

      representationPickerCtrl.deregisterPicker({ period,
                                                  bufferType: adaptation.type });
      const newPicker = representationPickerCtrl
        .registerPicker({ period, bufferType: adaptation.type },
                        newRepresentations);
      obs.next(newPicker);
      currentRepresentations = newRepresentations;
    }

    return () => {
      manifest.removeEventListener("decipherabilityUpdate", onDecipherabilityUpdate);
      representationPickerCtrl.deregisterPicker({ period,
                                                  bufferType: adaptation.type });
    };
  });
}

// XXX TODO
function getPlayableRepresentations(
  adaptation : Adaptation
) : Representation[] {
  /** Representations for which a `RepresentationStream` can be created. */
  const playableRepresentations = adaptation.getPlayableRepresentations();
  if (playableRepresentations.length <= 0) {
    const noRepErr = new MediaError("NO_PLAYABLE_REPRESENTATION",
                                    "No Representation in the chosen " +
                                    adaptation.type + " Adaptation can be played");
    throw noRepErr;
  }
  return playableRepresentations;
}
