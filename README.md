# zodiaco

A new Flutter project.

## Getting Started

### Development Server Setup
Game server is a Nodejs based websocket server.
#### 1. Install Nodejs

https://nodejs.org/en/download/

#### 2. Install npm dependencies
`npm i`
#### 3. Run server
`npm run start`


### deployment

Firebase web client deploy
```bash
# firebase setup see https://firebase.google.com/docs/hosting/quickstart
# build flutter app for web platform
flutter build web

# Test web app locally before deploy to server
firebase emulators:start

# deploy built web app to firebase hosting server
firebase deploy --only hosting

```
Web platform build of the flutter app will host on Firebase. [https://zodiaco-2ec68.web.app/#/](https://zodiaco-2ec68.web.app/#/).


But websocket Server will run on [Glitch](https://glitch.com/). (Running custom server program on Firebase is not a Free option).

