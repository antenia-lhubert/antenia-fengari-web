# antenia-fengari-web

This project is a simple rework of the [fengari-web](https://github.com/fengari-lua/fengari-web) project.

> Why this rework?

We needed to expose **all** fengari objects in a web environment, as well as easily create new lua contexts.

Usage example:

```html
<script type="text/javascript" src="antenia-fengari-web.js"></script>

<script>
    const {lua, lauxlib, lualib, to_luastring, interop, createLuaState} = window.fengari;

    async function runLua(code) {
        const {L, load} = createLuaState(true /* enable js interop, disabled by default */);
        interop.luaopen_js(L);
        //...context manipulation
        load(L, code)();
    }

    runLua(document.querySelector("script[type^='text/lua']").innerHTML)
</script>

<script type="text/lua">
    print('yay!');
</script>
```

We also removed automatic lua script tag execution to avoid unexpected behaviour.
