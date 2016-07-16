/**
 * React Starter Kit (https://www.reactstarterkit.com/)
 *
 * Copyright © 2014-2016 Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'babel-polyfill';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';

import routes from './routes';
import { port, auth, analytics } from './config';
import configureStore from './store/configureStore';
import { setRuntimeVariable } from './redux/actions/runtime';

import React from 'react'
import { renderToString } from 'react-dom/server'
import { Provider } from 'react-redux'
import { createMemoryHistory, match, RouterContext } from 'react-router'
import { syncHistoryWithStore } from 'react-router-redux'
import PrettyError from 'pretty-error';

const app = express();

//
// Tell any CSS tooling (such as Material UI) to use all vendor prefixes if the
// user agent is not known.
// -----------------------------------------------------------------------------
global.navigator = global.navigator || {};
global.navigator.userAgent = global.navigator.userAgent || 'all';

//
// Register Node.js middleware
// -----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

//
// Register server-side rendering middleware
// -----------------------------------------------------------------------------
app.use((req, res, next) => {
  const template = require('./views/index.jade'); // eslint-disable-line global-require
  const memoryHistory = createMemoryHistory(req.url);
  const store = configureStore(memoryHistory);
  const history = syncHistoryWithStore(memoryHistory, store);
  store.dispatch(setRuntimeVariable({
    name: 'initialNow',
    value: Date.now()
  }));

  // Send the rendered page back to the client
  match({history, routes, location: req.url}, (error, redirectLocation, renderProps) => {
    if (error) {
      res.status(500).send(error.message);
    } else if (redirectLocation) {
      res.redirect(302, redirectLocation.pathname + redirectLocation.search);
    } else if (!renderProps) {
      res.status(404).send('Not found');
    } else {
      getReduxPromise().then(() => {
        res.status(200);
        res.send(template({
          body: renderToString(
            <Provider store={store}>
              <RouterContext {...renderProps}/>
            </Provider>
          )
        }));
      }).catch((error) => {
        console.error('Error', error);
        res.send(error)
      });

      function getReduxPromise() {
        let { query, params } = renderProps;
        let component = renderProps.components[renderProps.components.length - 1].WrappedComponent;
        console.error('component', component);
        let promise = (component && component.fetchData)
          ? component.fetchData({query, params, history, store})
          : Promise.resolve();

        return promise;
      }
    }
  })
});

//
// Error handling
// -----------------------------------------------------------------------------
const pe = new PrettyError();
pe.skipNodeFiles();
pe.skipPackage('express');

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.log(pe.render(err)); // eslint-disable-line no-console
  const template = require('./views/error.jade'); // eslint-disable-line global-require
  const statusCode = err.status || 500;
  res.status(statusCode);
  res.send(template({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '' : err.stack,
  }));
});

//
// Launch the server
// -----------------------------------------------------------------------------
/* eslint-disable no-console */
app.listen(port, () => {
  console.log(`The server is running at http://localhost:${port}/`);
});
/* eslint-enable no-console */
