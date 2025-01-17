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

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

describe("compat - hasEMEAPIs", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  /* eslint-disable max-len */
  it("should return true if we could define a requestMediaKeySystemAccess function", () => {
  /* eslint-enable max-len */

    jest.mock("../eme", () => {
      return {
        __esModule: true as const,
        requestMediaKeySystemAccess: () => null,
      };
    });
    const hasEMEAPIs = jest.requireActual("../has_eme_apis");
    expect(hasEMEAPIs.default()).toBe(true);
  });

  /* eslint-disable max-len */
  it("should return false if we could not define a requestMediaKeySystemAccess function", () => {
  /* eslint-enable max-len */

    jest.mock("../eme", () => {
      return {
        __esModule: true as const,
        requestMediaKeySystemAccess: null,
      };
    });
    const hasEMEAPIs = jest.requireActual("../has_eme_apis");
    expect(hasEMEAPIs.default()).toBe(false);
  });
});
