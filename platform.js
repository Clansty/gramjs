"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNode = exports.isBrowser = exports.isDeno = void 0;
exports.isDeno = "Deno" in globalThis;
exports.isBrowser = false;
exports.isNode = !exports.isBrowser;
