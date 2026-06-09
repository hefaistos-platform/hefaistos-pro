# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

## ATT&CK Coverage configuration

The Coverage page embeds the MITRE ATT&CK Navigator and loads a live coverage layer JSON from the backend.

### Backend base URL

Set the environment variable `REACT_APP_API_URL` to the base URL of your backend (for example, your reverse proxy origin `https://localhost:8443` or `http://localhost:8080`; use `http://localhost:8000` only when running Django directly). The Coverage page builds the layer URL as:

```
${REACT_APP_API_URL}/api/coverage/layer.json
```

When `REACT_APP_API_URL` is not set during local development, you can use a CRA proxy to forward `/api` to the backend to keep requests same-origin.

### Authentication for the layer JSON

The layer endpoint supports two auth modes:

- Same-origin: session cookie (e.g. when frontend and backend share the same origin)
- Cross-origin: JWT token passed via query parameter `token`. The app reads `accessToken` from `localStorage` and appends it to the layer URL, for example:

```
${REACT_APP_API_URL}/api/coverage/layer.json?token=YOUR_JWT
```

The backend accepts tokens from `django-graphql-jwt` and `django-rest-framework-simplejwt`.

### Debugging

- Use the “Open raw JSON” button on the Coverage page to view the generated layer JSON in a new tab.
- If the embedded Navigator shows an error, paste the layer URL directly in the browser and ensure you receive JSON (not 403/404 or HTML).

## ATT&CK Navigator setup

The app now embeds the hosted Navigator at `https://mitre-attack.github.io/attack-navigator/enterprise/`. If you need a local instance in the future, see Docs/ATTACK_NAVIGATOR_SETUP.md (kept for fallback) for Angular and Docker run instructions.
