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

function registerLuaFunction(L, fn, name) {
	fengari.lua.lua_pushcfunction(L, function (L) {
		const args = new Array(fengari.lua.lua_gettop(L)).fill(undefined).map((_, index) => interop.tojs(L, index + 1));
		let result;
		try {
			result = fn(L, ...args);
		} catch (err) {
			interop.push(L, err);
			return fengari.lua.lua_error(L);
		}
		if (result instanceof Promise) {
			result
				.then(res => {
					interop.push(L, true);
					interop.push(L, res);
					fengari.lua.lua_resume(L, null, 2);
				})
				.catch(err => {
					interop.push(L, undefined);
					interop.push(L, err);
					fengari.lua.lua_resume(L, null, 2);
				});
			fengari.lua.lua_yield(L, 0);
			return 0;
		}
		interop.push(L, result);
		return 1;
	});
	fengari.lua.lua_setfield(L, -2, fengari.to_luastring(name));
}

function buildLuaRunner(exposedInteropLibs = {}) {
	const {L, load} = createLuaState(true);

	if(exposedInteropLibs) {
		Object.entries(exposedInteropLibs).forEach(([libName, libFunctions]) => {
			function createInteropLib(L) {
				fengari.lua.lua_newtable(L);

				Object.entries(libFunctions).forEach(([functionName, fn]) => {
					registerLuaFunction(L, fn, functionName);
				});

				return 1;
			}

			fengari.lauxlib.luaL_requiref(
				L,
				fengari.to_luastring(libName),
				createInteropLib,
				1
			);
			fengari.lua.lua_pop(L, 1);
		});
	}

	function runLua (code) {

		const executionPromise = Promise.withResolvers();

		fengari.lua.lua_pushcfunction(L, function (L) {
			const executionStatus = interop.tojs(L, 1);
			const executionResult = interop.tojs(L, 2);
			if (executionStatus) {
				executionPromise.resolve(executionResult);
			} else {
				executionPromise.reject(executionResult);
			}
			return 0;
		});
		fengari.lua.lua_setglobal(L, fengari.to_luastring("__executionResult"));

		const wrappedCode = "function __executionThread()\n" +
			"  function __main()\n" +
			code +
			" end\n" +
			"  __executionResult(pcall(__main));\n" +
			"end\n" +
			"coroutine.wrap(__executionThread)();";

		try {
			load(wrappedCode, undefined, L)();
		} catch (e) {
			executionPromise.reject(e);
		}

		return executionPromise.promise;
	}

	runLua.L = L;

	return runLua;
}

export * from "fengari";

export {
	interop,
	createLuaState,
	registerLuaFunction,
	buildLuaRunner
};