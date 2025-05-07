# antenia-fengari-web

This project is a simple rework of the [fengari-web](https://github.com/fengari-lua/fengari-web) project.

> Why this rework?

We needed to expose **all** fengari objects in a web environment, as well as easily create new lua contexts.

Usage example:

```html

<script type="text/javascript" src="antenia-fengari-web.js"></script>

<script>
    window.onload = function () {
        const {createLuaState} = window.fengari;

        async function runLua(code) {
            const {L, load} = createLuaState(true /* enable js interop, disabled by default */);
            //...context manipulation
            load(code)();
        }

        runLua(document.querySelector("script[type^='text/lua']").innerHTML)
    }
</script>

<script type="text/lua">
    print('yay!');
</script>
```

As to be able to execute and wait for asynchronous Javascript interop functions, we added a `buildLuaRunner` builder
that works the following way:

```html

<script type="text/javascript" src="antenia-fengari-web.js"></script>

<script>
    window.onload = function () {
        const luaArea = document.getElementById("lua-area");

        const executeButton = document.getElementById("execute");

        const luaRunner = window.fengari.buildLuaRunner({
            commons: {
                syncFunction: function (L, nmb) {
                    if (nmb < 50) {
                        return "Under 50!";
                    } else {
                        return "Over or equal 50!";
                    }
                },
                asyncFunction: function (L, nmb) {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            if (nmb < 50) {
                                reject("Under 50!");
                            } else {
                                resolve("Over or equal 50!");
                            }
                        }, 500);
                    });
                }
            }
        });
        const L = luaRunner.L;

        //...context manipulation

        async function runLua(code) {
            return luaRunner(code);
        }

        function execute() {
            console.clear();
            console.info("Starting execution");
            console.info(luaArea.value);
            runLua(luaArea.value)
                    .then(res => console.warn("Success!", res))
                    .catch(res => console.error("Error!", res));
        }

        document.addEventListener("keydown", (event) => {
            if (event.ctrlKey && event.key === "Enter") {
                execute();
            }
        });

        executeButton.addEventListener("click", (ev) => {
            ev.stopPropagation();
            execute();
        });
    };
</script>

<script type="text/lua">
    print(commons.syncFunction(10));
    print(commons.syncFunction(90));
    
    local s, r = commons.asyncFunction(10);
    print(tostring(s) .. ', ' .. r);
    local s, r = commons.asyncFunction(90);
    print(tostring(s) .. ', ' .. r);
    
    if not commons.asyncFunction(100) then
      error('failed, arbitrary value does not meet condition');
    end
    
    return 'yay!';
</script>
```

We expose interop libraries via the first argument using the following structure:

```js
_ = {
	"LIBRARY_NAME":
		{
			"FUNCTION_NAME": (L, ...args) => {/* Javascript function (can be async) */
				return void 0; /* result */
			}
		}
}
```

Under the hood, we wrap the lua script inside a coroutine and a function to pause the thread execution when waiting for
async results.

We also removed automatic lua script tag execution to avoid unexpected behaviour.
