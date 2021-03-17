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
import { IInitializationDataInfo } from "../types";
/**
 * Store a unique value associated to an initData and initDataType.
 * @class InitDataStore
 */
export default class InitDataStore<T> {
    /**
     * Contains every stored elements alongside the corresponding initialization
     * data, in storage chronological order (from first stored to last stored).
     */
    private _storage;
    /** Construct a new InitDataStore.  */
    constructor();
    /**
     * Returns all stored value, in the order in which they have been stored.
     * Note: it is possible to move a value to the end of this array by calling
     * the `getAndReuse` method.
     * @returns {Array}
     */
    getAll(): T[];
    /**
     * Returns the number of stored values.
     * @returns {number}
     */
    getLength(): number;
    /**
     * Returns the element associated with the given initData and initDataType.
     * Returns `undefined` if not found.
     * @param {Uint8Array} initData
     * @param {string|undefined} initDataType
     * @returns {*}
     */
    get(initializationData: IInitializationDataInfo): T | undefined;
    /**
     * Like `get`, but also move the corresponding value at the end of the store
     * (as returned by `getAll`) if found.
     * This can be used for example to tell when a previously-stored value is
     * re-used to then be able to implement a caching replacement algorithm based
     * on the least-recently-used values by just evicting the first values
     * returned by `getAll`.
     * @param {Uint8Array} initData
     * @param {string|undefined} initDataType
     * @returns {*}
     */
    getAndReuse(initializationData: IInitializationDataInfo): T | undefined;
    /**
     * Add to the store a value linked to the corresponding initData and
     * initDataType.
     * If a value was already stored linked to those, replace it.
     * @param {Object} initializationData
     * @param {*} payload
     */
    store(initializationData: IInitializationDataInfo, payload: T): void;
    /**
     * Add to the store a value linked to the corresponding initData and
     * initDataType.
     * If a value linked to those was already stored, do nothing and returns
     * `false`.
     * If not, add the value and return `true`.
     *
     * This can be used as a more performant version of doing both a `get` call -
     * to see if a value is stored linked to that data - and then if not doing a
     * store. `storeIfNone` is more performant as it will only perform hashing
     * and a look-up a single time.
     * @param {Object} initializationData
     * @param {*} payload
     * @returns {boolean}
     */
    storeIfNone(initializationData: IInitializationDataInfo, payload: T): boolean;
    /**
     * Remove an initDataType and initData combination from this store.
     * Returns the associated value if it has been found, `undefined` otherwise.
     * @param {Uint8Array} initData
     * @param {string|undefined} initDataType
     * @returns {*}
     */
    remove(initializationData: IInitializationDataInfo): T | undefined;
    /**
     * Find the index of the corresponding initialization data in `this._storage`.
     * Returns `-1` if not found.
     * @param {Object} initializationData
     * @returns {boolean}
     */
    private _findIndex;
    /**
     * Format given initializationData's values so they are ready to be stored:
     *   - sort them by systemId, so they are faster to compare
     *   - add hash for each initialization data encountered.
     * @param {Array.<Object>} initialValues
     * @returns {Array.<Object>}
     */
    private _formatValuesForStore;
}
