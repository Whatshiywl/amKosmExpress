var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors');

import ApiRoutes from './routes/apiRoutes';

class App {

  app = express();

  constructor() {

    this.app.use(cors());

    // view engine setup
    this.app.set('views', path.resolve('views'));
    this.app.set('view engine', 'html');
    // app.set('view engine', 'ejs');

    // uncomment after placing your favicon in /public
    //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
    this.app.use(logger('dev'));
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: false }));
    this.app.use(cookieParser());
    this.app.use(express.static(path.resolve('public')));

    this.app.use('/api/v1', ApiRoutes);

    // catch 404 and forward to error handler
    this.app.use(function(req, res, next) {
      var err = {
        message: 'Not Found',
        status: 404
      }
      next(err);
    });

    // error handler
    this.app.use(function(err, req, res, next) {
      // set locals, only providing error in development
      res.locals.message = err.message;
      res.locals.error = req.app.get('env') === 'development' ? err : {};

      // render the error page
      res.status(err.status || 500);
      res.send(JSON.stringify(err));
    });
  }
}

export default new App().app;
