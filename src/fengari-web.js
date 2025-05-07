"use strict";

import * as interop from "fengari-interop";
import * as fengari from "fengari";

function createLuaState(globalJsInterop = false) {
	const L = fengari.lauxlib.luaL_newstate();

	fengari.lualib.luaL_openlibs(L);

	if (globalJsInterop) {
		fengari.lauxlib.luaL_requiref(L, fengari.to_luastring("js"), interop.luaopen_js, 1);
		fengari.lua.lua_pop(L, 1);
	}

	fengari.lua.lua_pushstring(L, fengari.to_luastring(fengari.FENGARI_COPYRIGHT));
	fengari.lua.lua_setglobal(L, fengari.to_luastring("_COPYRIGHT"));

	function load(source, chunkname, ctx = L) {
		if (typeof source == "string")
			source = fengari.to_luastring(source);
		else if (!(source instanceof Uint8Array))
			throw new TypeError("expects an array of bytes or javascript string");

		chunkname = chunkname ? fengari.to_luastring(chunkname) : null;
		let ok = fengari.lauxlib.luaL_loadbuffer(ctx, source, null, chunkname);
		let res;
		if (ok === fengari.lua.LUA_ERRSYNTAX) {
			res = new SyntaxError(fengari.lua.lua_tojsstring(ctx, -1));
		} else {
			res = interop.tojs(ctx, -1);
		}
		fengari.lua.lua_pop(ctx, 1);
		if (ok !== fengari.lua.LUA_OK) {
			throw res;
		}
		return res;
	}

	return {L, load};
}

export * from "fengari";

export {
	interop,
	createLuaState
};