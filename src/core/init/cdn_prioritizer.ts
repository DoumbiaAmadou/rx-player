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
import Manifest from "../../manifest";
import { IContentSteeringMetadata } from "../../parsers/manifest";
import { ISteeringManifest } from "../../parsers/SteeringManifest";
import { IPlayerError } from "../../public_types";
import arrayIncludes from "../../utils/array_includes";
import EventEmitter from "../../utils/event_emitter";
import createSharedReference, {
  ISharedReference,
} from "../../utils/reference";
import TaskCanceller, {
  CancellationError,
} from "../../utils/task_canceller";
import SteeringManifestFetcher from "../fetchers/steering_manifest";

// XXX TODO
const DEFAULT_CDN_DOWNGRADE_TIME = 60;

/**
 * Class signaling the priority between multiple CDN available for any given
 * resource, through the usage of various "labels", each identifying a CDN.
 *
 * It might rely behind the hood on a fetched document giving priorities such as
 * a Content Steering Manifest and also on issues that appeared with some given
 * CDN in the [close] past.
 *
 * This class might perform requests and schedule timeouts by itself to keep its
 * internal list of CDN priority up-to-date.
 * When it is not needed anymore, you should call the `dispose` method to clear
 * all resources.
 *
 * @class CdnPrioritizer
 */
export default class CdnPrioritizer extends EventEmitter<ICdnPrioritizerEvents> {
  private _readyState : ISharedReference<"not-ready" | "ready" | "disposed">;

  /**
   * Metadata parsed from the last Content Steering Manifest loaded.
   *
   * `null` either if there's no such Manifest or if it is currently being
   * loaded for the first time.
   */
  private _lastSteeringManifest : ISteeringManifest | null;

  /**
   * Structure keeping a list of CDN currently downgraded.
   * Downgraded CDN immediately have a lower priority than any non-downgraded
   * CDN for a specific amount of time.
   */
  private _downgradedCdnList : {
    /** Labels of downgraded CDN, in no important order. */
    labels : string[];
    /**
     * Timeout ID (to give to `clearTimeout`) of elements in the `labels` array,
     * for the element at the same index in the `labels` array.
     *
     * This structure has been writted as an object of two arrays of the same
     * length, instead of an array of objects, to simplify the usage of the
     * `labels` array which is used considerably more than the `timeouts` array`.
     */
    timeouts : number[];
  };

  /**
   * TaskCanceller allowing to abort the process of loading and refreshing the
   * Content Steering Manifest.
   * Set to `null` when no such process is pending.
   */
  private _steeringManifestUpdateCanceller : TaskCanceller | null;

  /**
   * @param {Object} steeringManifestFetcher
   * @param {Object} manifest
   */
  constructor(
    steeringManifestFetcher : SteeringManifestFetcher,
    manifest : Manifest
  ) {
    super();
    this._lastSteeringManifest = null;
    this._downgradedCdnList = { labels: [], timeouts: [] };
    this._steeringManifestUpdateCanceller = null;

    let lastContentSteering = manifest.contentSteering;

    manifest.addEventListener("manifestUpdate", () => {
      const prevContentSteering = lastContentSteering;
      lastContentSteering = manifest.contentSteering;
      if (prevContentSteering === null) {
        if (lastContentSteering !== null) {
          log.info("CP: A Steering Manifest is declared in a new Manifest");
          this._autoRefreshSteeringManifest(steeringManifestFetcher,
                                            lastContentSteering);
        }
      } else if (lastContentSteering === null) {
        log.info("CP: A Steering Manifest is removed in a new Manifest");
        this._steeringManifestUpdateCanceller?.cancel();
        this._steeringManifestUpdateCanceller = null;
      } else if (prevContentSteering.url !== lastContentSteering.url ||
                 prevContentSteering.proxyUrl !== lastContentSteering.proxyUrl)
      {
        log.info("CP: A Steering Manifest's information changed in a new Manifest");
        this._steeringManifestUpdateCanceller?.cancel();
        this._steeringManifestUpdateCanceller = null;
        this._autoRefreshSteeringManifest(steeringManifestFetcher,
                                          lastContentSteering);
      }
    });

    if (manifest.contentSteering !== null) {
      const readyState = manifest.contentSteering.queryBeforeStart ? "not-ready" :
                                                                     "ready";
      this._readyState = createSharedReference(readyState);
      this._autoRefreshSteeringManifest(steeringManifestFetcher,
                                        manifest.contentSteering);
    } else {
      this._readyState = createSharedReference("ready");
    }
  }

  public dispose() : void {
    this._readyState.setValue("disposed");
    this._readyState.finish();
    this._steeringManifestUpdateCanceller?.cancel();
    this._steeringManifestUpdateCanceller = null;
    this._lastSteeringManifest = null;
    for (const timeout of this._downgradedCdnList.timeouts) {
      clearTimeout(timeout);
    }
    this._downgradedCdnList = { labels: [], timeouts: [] };
  }

  /**
   * From the list of __ALL__ CDNs available to a resource, return them in the
   * order in which requests should be performed.
   *
   * Note: It is VERY important to include all CDN that are able to reach the
   * wanted resource, even those which will in the end not be used anyway.
   * If some CDN are not communicated, the `CDNPrioritizer` might wrongly
   * consider that the current resource don't have any of the CDN prioritized
   * internally and return other CDN which should have been forbidden if it knew
   * about the other, non-used, ones.
   *
   * @param {Array.<string>} everyCdnForResource - Array of ALL available CDN
   * able to reach the wanted resource - even those which might not be used in
   * the end.
   * @returns {Array.<string>} - Array of CDN that can be tried to reach the
   * resource, sorted by order of CDN preference, according to the
   * `CDNPrioritizer`'s own list of priorities.
   */
  public getCdnPreferenceForResource(
    everyCdnForResource : string[]
  ) : ISyncOrAsync<string[]> {
    if (everyCdnForResource.length <= 1) {
      // The huge majority of contents have only one CDN available.
      // Here, prioritizing make no sense.
      return createSync(everyCdnForResource);
    }

    if (!this._readyState.getValue()) {
      const val = new Promise<string[]>((res, rej) => {
        this._readyState.onUpdate((readyState) => {
          if (readyState === "ready") {
            res(this._innerGetCdnPreferenceForResource(everyCdnForResource));
          } else if (readyState === "disposed") {
            rej(new CancellationError());
          }
        });
      });
      return { type: "async", val };
    }
    return createSync(this._innerGetCdnPreferenceForResource(everyCdnForResource));
  }

  /**
   * From the list of __ALL__ CDNs available to a resource, return them in the
   * order in which requests should be performed.
   *
   * Note: It is VERY important to include all CDN that are able to reach the
   * wanted resource, even those which will in the end not be used anyway.
   * If some CDN are not communicated, the `CDNPrioritizer` might wrongly
   * consider that the current resource don't have any of the CDN prioritized
   * internally and return other CDN which should have been forbidden if it knew
   * about the other, non-used, ones.
   *
   * @param {Array.<string>} everyCdnForResource - Array of ALL available CDN
   * able to reach the wanted resource - even those which might not be used in
   * the end.
   * @returns {Array.<string>} - Array of CDN that can be tried to reach the
   * resource, sorted by order of CDN preference, according to the
   * `CDNPrioritizer`'s own list of priorities.
   */
  private _innerGetCdnPreferenceForResource(
    everyCdnForResource : string[]
  ) : string[] {
    let cdnBase;
    if (this._lastSteeringManifest !== null) {
      const priorities = this._lastSteeringManifest.priorities;
      const inSteeringManifest = everyCdnForResource.filter(available =>
        arrayIncludes(priorities, available));
      if (inSteeringManifest.length > 0) {
        cdnBase = inSteeringManifest;
      }
    }

    if (cdnBase === undefined) {
      cdnBase = everyCdnForResource;
    }
    const [allowedInOrder, downgradedInOrder] = cdnBase
      .reduce((acc : [string[], string[]], elt : string) => {
        if (arrayIncludes(this._downgradedCdnList.labels, elt)) {
          acc[1].push(elt);
        } else {
          acc[0].push(elt);
        }
        return acc;
      }, [[], []]);
    return allowedInOrder.concat(downgradedInOrder);
  }

  /**
   * Limit usage of the CDN with the given label for a configured amount of
   * time.
   * Call this method if you encountered an issue with that CDN which leads you
   * to want to prevent its usage currently.
   *
   * Note that the CDN can still be the preferred one if no other CDN exist for
   * a wanted resource.
   * @param {string} label
   */
  public downgradeCdn(label : string) : void {
    const indexOf = this._downgradedCdnList.labels.indexOf(label);
    if (indexOf >= 0) {
      this._removeIndexFromDowngradeList(indexOf);
    }

    const downgradeTime = this._lastSteeringManifest?.lifetime ??
                          DEFAULT_CDN_DOWNGRADE_TIME;
    this._downgradedCdnList.labels.push(label);
    const timeout = window.setTimeout(() => {
      const newIndex = this._downgradedCdnList.labels.indexOf(label);
      if (newIndex >= 0) {
        this._removeIndexFromDowngradeList(newIndex);
      }
    }, downgradeTime);
    this._downgradedCdnList.timeouts.push(timeout);
  }

  private _autoRefreshSteeringManifest(
    steeringManifestFetcher : SteeringManifestFetcher,
    contentSteering : IContentSteeringMetadata
  ) {
    if (this._steeringManifestUpdateCanceller === null) {
      const steeringManifestUpdateCanceller = new TaskCanceller();
      this._steeringManifestUpdateCanceller = steeringManifestUpdateCanceller;
    }
    const canceller : TaskCanceller = this._steeringManifestUpdateCanceller;
    steeringManifestFetcher.fetch(contentSteering.url,
                                  (err : IPlayerError) => this.trigger("warnings", [err]),
                                  canceller.signal)
      .then((parse) => {
        const parsed = parse((errs) => this.trigger("warnings", errs));
        this._lastSteeringManifest = parsed;
        if (this._readyState.getValue() === "not-ready") {
          this._readyState.setValue("ready");
        }
        if (canceller.isUsed) {
          return;
        }
        if (parsed.lifetime > 0) {
          const timeout = window.setTimeout(() => {
            canceller.signal.deregister(onTimeoutEnd);
            this._autoRefreshSteeringManifest(steeringManifestFetcher, contentSteering);
          }, parsed.lifetime * 1000);
          canceller.signal.register(onTimeoutEnd);
          function onTimeoutEnd() {
            clearTimeout(timeout);
          }
        }
      })
      .catch((err) => {
        if (err instanceof CancellationError) {
          return;
        }
        throw new Error("XXX TODO" + String(err));
      });
  }

  /**
   * @param {number} index
   */
  private _removeIndexFromDowngradeList(index : number) : void {
    this._downgradedCdnList.labels.splice(index, 1);
    const oldTimeout = this._downgradedCdnList.timeouts.splice(index, 1);
    clearTimeout(oldTimeout[0]);
  }
}

export interface ICdnPrioritizerEvents {
  warnings : IPlayerError[];
}

/**
 * Wrap an underlying value that might either be obtained synchronously (a
 * "sync" value) or asynchronously by awaiting a Promise (an "async" value).
 *
 * This type was created instead of just relying on Promises everytime, to
 * avoid the necessity of always having the overhead and always-async behavior
 * of a Promise for a value that might be in most time obtainable synchronously.
 */
export type ISyncOrAsync<T> =
  { type: "sync";
    val: T; } |
  { type: "async";
    val: Promise<T>; };

function createSync<T>(val : T) : ISyncOrAsync<T> {
  return { type: "sync", val };
}
