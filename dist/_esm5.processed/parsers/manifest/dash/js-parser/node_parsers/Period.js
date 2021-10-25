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
import { createAdaptationSetIntermediateRepresentation, } from "./AdaptationSet";
import parseBaseURL from "./BaseURL";
import parseEventStream from "./EventStream";
import parseSegmentTemplate from "./SegmentTemplate";
import { parseBoolean, parseDuration, ValueParser, } from "./utils";
/**
 * @param {NodeList} periodChildren
 * @returns {Array}
 */
function parsePeriodChildren(periodChildren) {
    var baseURLs = [];
    var adaptations = [];
    var segmentTemplate;
    var warnings = [];
    var eventStreams = [];
    for (var i = 0; i < periodChildren.length; i++) {
        if (periodChildren[i].nodeType === Node.ELEMENT_NODE) {
            var currentElement = periodChildren[i];
            switch (currentElement.nodeName) {
                case "BaseURL":
                    var _a = parseBaseURL(currentElement), baseURLObj = _a[0], baseURLWarnings = _a[1];
                    if (baseURLObj !== undefined) {
                        baseURLs.push(baseURLObj);
                    }
                    warnings = warnings.concat(baseURLWarnings);
                    break;
                case "AdaptationSet":
                    var _b = createAdaptationSetIntermediateRepresentation(currentElement), adaptation = _b[0], adaptationWarnings = _b[1];
                    adaptations.push(adaptation);
                    warnings = warnings.concat(adaptationWarnings);
                    break;
                case "EventStream":
                    var _c = parseEventStream(currentElement), eventStream = _c[0], eventStreamWarnings = _c[1];
                    eventStreams.push(eventStream);
                    warnings = warnings.concat(eventStreamWarnings);
                    break;
                case "SegmentTemplate":
                    var _d = parseSegmentTemplate(currentElement), parsedSegmentTemplate = _d[0], segmentTemplateWarnings = _d[1];
                    segmentTemplate = parsedSegmentTemplate;
                    if (segmentTemplateWarnings.length > 0) {
                        warnings = warnings.concat(segmentTemplateWarnings);
                    }
                    break;
            }
        }
    }
    return [{ baseURLs: baseURLs, adaptations: adaptations, eventStreams: eventStreams, segmentTemplate: segmentTemplate }, warnings];
}
/**
 * @param {Element} periodElement
 * @returns {Array}
 */
function parsePeriodAttributes(periodElement) {
    var res = {};
    var warnings = [];
    var parseValue = ValueParser(res, warnings);
    for (var i = 0; i < periodElement.attributes.length; i++) {
        var attr = periodElement.attributes[i];
        switch (attr.name) {
            case "id":
                res.id = attr.value;
                break;
            case "start":
                parseValue(attr.value, { asKey: "start",
                    parser: parseDuration,
                    dashName: "start" });
                break;
            case "duration":
                parseValue(attr.value, { asKey: "duration",
                    parser: parseDuration,
                    dashName: "duration" });
                break;
            case "bitstreamSwitching":
                parseValue(attr.value, { asKey: "bitstreamSwitching",
                    parser: parseBoolean,
                    dashName: "bitstreamSwitching" });
                break;
            case "xlink:href":
                res.xlinkHref = attr.value;
                break;
            case "xlink:actuate":
                res.xlinkActuate = attr.value;
                break;
        }
    }
    return [res, warnings];
}
/**
 * @param {Element} periodElement
 * @returns {Array}
 */
export function createPeriodIntermediateRepresentation(periodElement) {
    var _a = parsePeriodChildren(periodElement.childNodes), children = _a[0], childrenWarnings = _a[1];
    var _b = parsePeriodAttributes(periodElement), attributes = _b[0], attrsWarnings = _b[1];
    var warnings = childrenWarnings.concat(attrsWarnings);
    return [{ children: children, attributes: attributes }, warnings];
}
