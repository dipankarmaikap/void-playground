# Manual check: browser runtime error recovery

This check exercises the app's enhanced-navigation failure path without browser
automation.

1. Start the app with `npm run dev` and open `/` in a browser that supports the
   Navigation API and `NavigateEvent.sourceElement`.
2. In DevTools Console, install a one-shot failure for the next Remix frame
   request:

   ```js
   (() => {
     const originalFetch = window.fetch.bind(window);
     window.fetch = (input, init) => {
       if (new Headers(init?.headers).get('X-Remix-Frame') === 'true') {
         window.fetch = originalFetch;
         return Promise.reject(new Error('manual enhanced navigation failure'));
       }
       return originalFetch(input, init);
     };
   })();
   ```

3. Click **Log in** or **Create account**. The browser console should show a
   `Browser runtime error` entry with the original
   `manual enhanced navigation failure` error, and the page should show an
   alert with a **Reload page** button.
4. Click **Reload page**. The failed interaction should recover through an
   ordinary document reload, and the destination page should load normally.

The reporter currently writes to the browser console; this app has no remote
browser-error reporting service.
