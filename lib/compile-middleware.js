/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const babelCore = require("babel-core");
const content_type_1 = require("content-type");
const dom5 = require("dom5");
const LRU = require("lru-cache");
const parse5 = require("parse5");
const ua_parser_js_1 = require("ua-parser-js");
const transform_middleware_1 = require("./transform-middleware");
const babelTransformers = [
    'babel-plugin-transform-es2015-arrow-functions',
    'babel-plugin-transform-es2015-block-scoped-functions',
    'babel-plugin-transform-es2015-block-scoping',
    'babel-plugin-transform-es2015-classes',
    'babel-plugin-transform-es2015-computed-properties',
    'babel-plugin-transform-es2015-destructuring',
    'babel-plugin-transform-es2015-duplicate-keys',
    'babel-plugin-transform-es2015-for-of',
    'babel-plugin-transform-es2015-function-name',
    'babel-plugin-transform-es2015-literals',
    'babel-plugin-transform-es2015-object-super',
    'babel-plugin-transform-es2015-parameters',
    'babel-plugin-transform-es2015-shorthand-properties',
    'babel-plugin-transform-es2015-spread',
    'babel-plugin-transform-es2015-sticky-regex',
    'babel-plugin-transform-es2015-template-literals',
    'babel-plugin-transform-es2015-typeof-symbol',
    'babel-plugin-transform-es2015-unicode-regex',
    'babel-plugin-transform-regenerator',
].map((name) => require(name));
const javaScriptMimeTypes = [
    'application/javascript',
    'application/ecmascript',
    'text/javascript',
    'text/ecmascript',
];
const htmlMimeType = 'text/html';
const compileMimeTypes = [
    htmlMimeType,
].concat(javaScriptMimeTypes);
function getContentType(response) {
    const contentTypeHeader = response.getHeader('Content-Type');
    return contentTypeHeader && content_type_1.parse(contentTypeHeader).type;
}
function isSuccessful(response) {
    const statusCode = response.statusCode;
    return (statusCode >= 200 && statusCode < 300);
}
// NOTE: To change the max length of the cache at runtime, just use bracket
// notation, i.e. `babelCompileCache['max'] = 64 * 1024` for 64KB limit.
exports.babelCompileCache = LRU({
    length: (n, key) => n.length + key.length
});
function babelCompile(forceCompile) {
    if (forceCompile == null) {
        forceCompile = false;
    }
    return transform_middleware_1.transformResponse({
        shouldTransform(_request, response) {
            return isSuccessful(response) &&
                compileMimeTypes.indexOf(getContentType(response)) >= 0;
        },
        transform(request, response, body) {
            const contentType = getContentType(response);
            const uaParser = new ua_parser_js_1.UAParser(request.headers['user-agent']);
            const compile = forceCompile || needCompilation(uaParser);
            if (compile) {
                const source = body;
                const cached = exports.babelCompileCache.get(source);
                if (cached !== undefined) {
                    return cached;
                }
                if (contentType === htmlMimeType) {
                    body = compileHtml(source, request.path);
                }
                if (javaScriptMimeTypes.indexOf(contentType) !== -1) {
                    body = compileScript(source);
                }
                exports.babelCompileCache.set(source, body);
            }
            return body;
        },
    });
}
exports.babelCompile = babelCompile;
function compileHtml(source, location) {
    const document = parse5.parse(source);
    const scriptTags = dom5.queryAll(document, isInlineJavaScript);
    for (const scriptTag of scriptTags) {
        try {
            const script = dom5.getTextContent(scriptTag);
            const compiledScriptResult = compileScript(script);
            dom5.setTextContent(scriptTag, compiledScriptResult);
        }
        catch (e) {
            // By not setting textContent we keep the original script, which
            // might work. We may want to fail the request so a better error
            // shows up in the network panel of dev tools. If this is the main
            // page we could also render a message in the browser.
            console.warn(`Error compiling script in ${location}: ${e.message}`);
        }
    }
    return parse5.serialize(document);
}
function compileScript(script) {
    return babelCore
        .transform(script, {
        plugins: babelTransformers,
    })
        .code;
}
const isInlineJavaScript = dom5.predicates.AND(dom5.predicates.hasTagName('script'), dom5.predicates.NOT(dom5.predicates.hasAttr('src')));
function needCompilation(uaParser) {
    const browser = uaParser.getBrowser();
    const versionSplit = browser.version && browser.version.split('.');
    const majorVersion = versionSplit ? parseInt(versionSplit[0], 10) : -1;
    const supportsES2015 = (browser.name === 'Chrome' && majorVersion >= 49) ||
        (browser.name === 'Safari' && majorVersion >= 10) ||
        (browser.name === 'Edge' && majorVersion >= 14) ||
        (browser.name === 'Firefox' && majorVersion >= 51);
    return !supportsES2015;
}
//# sourceMappingURL=compile-middleware.js.map