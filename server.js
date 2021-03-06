var express         = require('express');
var morgan          = require('morgan');
var connect         = require('connect');
var log             = require('simplog');
var path            = require('path');
var fs              = require('fs');
var lockfile        = require('lockfile');

config = {
  logDir: process.env.LOG_DIR || path.join(process.cwd(), "/logs")
};

var app = express();

app.use(connect());
app.use(morgan('combined'));

app.get('*', function(req, res){ res.send({status: "ok"}); });

function getFilePathForRequest(req){
  return path.join(config.logDir, req.path.replace(/^\//, "").replace(/[^a-z|A-Z|0-9|\.]/g, "_"));
}

app.post('*', function(req, res){
  var filePath = getFilePathForRequest(req);
  var isDateStamped = "no_timestamp" in req.query;
  log.info("handling: ", req.path);
  var s = "";
  lockfile.lock(filePath + ".lock", {wait: 2000}, function (err){
    if (err){
      log.error("Error locking: ", filePath);
      log.error(err);
      res.send({status: "error"});
      return;
    }
    req.on('data', function(chunk){
      if (!isDateStamped){
        chunk = "[" + new Date().toISOString() + "] " + chunk.toString();
        isDateStamped = true;
      }
      s += chunk;
    });
    req.on('end', function(){
      s += "\n"
      fs.appendFile(filePath, s, function(err){
        if (err){
          log.error("error writing data to: %s", filePath);
          log.error(err);
          res.send({status: "error"});
        }
      });
      // similarly to EOL appending we don't concern our caller with the
      // potential failure during unlock
      lockfile.unlock(filePath + ".lock", function(err){
        if (err){
          log.error("Error unlocking file: ", filePath);
        }
      });
      res.send({status: "complete"});
    });
  });
});

listenPort = process.env.PORT || 3000;

if (!fs.existsSync(config.logDir)){
  log.error("Logdir %s missing, halting", config.logDir);
  process.exit(1);
}
log.info("starting app " + process.env.APP_NAME);
log.info("listening on " + listenPort);
app.listen(listenPort);
