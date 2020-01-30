/**
 * Copyright 2019 CANAL+ Group
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

import { IDBPDatabase } from "idb";
import { map } from "rxjs/operators";

import EMEManager from "../../../../../core/eme/eme_manager";
import {
  IKeySystemOption,
  IPersistedSessionData,
} from "../../../../../core/eme/types";
import { IndexedDBError } from "../../utils";
import { IUtilsKeySystemsTransaction } from "./types";

/**
 * Get the licence when keysSystems are specified
 *
 * @remarks
 * This function is basically reproducing the getLicence from the rx-player, but we are
 * adding an additional step to catch the licence and resolve a promise with the licence
 * To get the challenge we need to retrieve the licence
 * we are instanciating a minimal rxPlayer
 * @param {ILicenceOptions} KeySystemsOption KeySystems configuration
 *  provided at the download call
 * @param {IUtilsKeySystemsTransaction} keySystemsUtils Utils that we need
 *  to create/store encrypted content
 * @param {IDBPDatabase} db The current opened IndexedDB instance
 * @returns {Observable<{...}>} An observable of EME events
 */
function EMETransaction(
  KeySystemsOption: IKeySystemOption,
  keySystemsUtils: IUtilsKeySystemsTransaction,
  db: IDBPDatabase
) {
  const video = document.createElement("video");
  const { contentID, contentProtection$ } = keySystemsUtils;
  const keySystems = [
    {
      ...KeySystemsOption,
      licenseStorage: {
        save(sessionsIDS: IPersistedSessionData[]) {
          db.add("contentsProtection", {
            contentID,
            drmKey: `${contentID}--${Date.now()}`,
            keySystems: {
              sessionsIDS,
              type: KeySystemsOption.type,
            },
          }).catch((err: Error) => {
            throw new IndexedDBError(`${contentID}:
              Impossible to store contentProtection in IndexedDB: ${err.message}
            `);
          });
        },
        load() {
          return [];
        },
      },
      persistentLicense: true,
      persistentStateRequired: true,
    },
  ];
  return EMEManager(video, keySystems, contentProtection$).pipe(
    map((emeEvt) => ({ emeEvtType: emeEvt.type }))
  );
}

export default EMETransaction;
