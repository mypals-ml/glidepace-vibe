# Debugging Locally

This guide provides instructions on how to debug the application locally.

## Backend (Node.js)

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Start the backend server in debug mode:**
    ```bash
    node --inspect src/index.js
    ```
3.  **Open the Chrome DevTools:**
    *   Open Chrome and navigate to `chrome://inspect`.
    *   Click on the "Open dedicated DevTools for Node" link.
   3.1  **Open the Edge DevTools:**
       *   Open Edge and navigate to `edge://inspect`.
       *   Click on the "Open dedicated DevTools for Node" link.
4.  **Set breakpoints:**
    *   You can now set breakpoints in your backend code and inspect variables.

## Frontend (Vue.js)

1.  **Install dependencies and start the server:**
    From the root directory, run the following commands to install frontend dependencies and start the development server:
    ```bash
    cd client
    npm install
    npm run serve
    ```
2.  **Open the browser DevTools:**
    *   Open your browser and navigate to the application (usually `http://localhost:8080`).
    *   Open the browser's developer tools (usually by pressing F12).
3.  **Use Vue Devtools:**
    *   Install the Vue Devtools browser extension for a better debugging experience.
    *   You can inspect components, view their data, and track events.
4. **Add `debugger` at the line you want it to break**
    *   That will help you to break and locate the js file in the browser more quickly.
---

## A Note on `npm install` and Security Audits

When you run `npm install` for either the backend or the frontend, you will see a summary in your terminal after the installation is complete. This output is normal and provides useful information. Here's a quick guide to understanding it:

*   **Package Summary (`added X packages...`)**: This line simply confirms how many packages were successfully downloaded and installed.
*   **Funding (`X packages are looking for funding...`)**: This is an informational message from developers of open-source packages who are seeking donations. It does not indicate an error and can be safely ignored.
*   **Vulnerabilities (`X vulnerabilities...`)**: This is an important security report from `npm audit`. It means that some of the packages you installed have known security flaws. The report categorizes them by severity (low, moderate, high, critical).

### What to do about vulnerabilities?

It is always a good practice to fix these reported vulnerabilities. `npm` provides a command to do this automatically. After `npm install` is finished, run the following command in the same directory (`client` or the project root):

```bash
npm audit fix
```

This command will attempt to upgrade the vulnerable packages to a secure version without introducing breaking changes to your project. It is generally safe to run. If there are still remaining vulnerabilities, especially critical ones, you may need to investigate them further, but `npm audit fix` is the correct first step.
