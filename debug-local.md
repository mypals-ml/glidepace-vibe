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
