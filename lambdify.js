#!/usr/bin/env node

require('shelljs/global');

var flags = require('flags'),
  fs = require('fs');
require('colors');

flags.defineString('function', '', 'Name of the Lambda function');
flags.defineMultiString('env', '', 'Environment variable to set in entry point. E.g. MONGO_URL');
flags.defineString('settings', '', 'Settings file to parse and set as the METEOR_SETTINGS environment variable in the entry point. E.g. "settings.development.json"');
flags.defineBoolean('debug', false, 'If set to true, this will build in the current directory without archiving or uploading. Use for testing your bundled application locally.');
flags.defineBoolean('upload', true, 'Whether to upload the bundle to Lambda');

flags.parse();

// Fake ROOT_URL just so Meteor won't crash if there isn't one.
var ENV = {
  ROOT_URL: 'http://lambda-host.aws.com'
};

if (flags.get('settings')) {
  var settings = fs.readFileSync(pwd() + '/' + flags.get('settings'));
  ENV.METEOR_SETTINGS = settings.toString();
}

var envVars = flags.get('env');
var spl;

if (envVars) {
  envVars.forEach(function(v) {
    spl = v.split('=');
    ENV[spl.shift()] = spl.join('=');
  });
}
var tempDir = '/tmp/meteor_lambda_' + (new Date()).toISOString();
if (flags.get('debug')) {
  tempDir = pwd() + '/lambda-bundle';
}

if (fs.existsSync(tempDir)) {
  rm('-rf', tempDir);
}



var exit = function(code, msg) {
  if (flags.get('upload')) {
    rm('-rf', tempDir);
  }

  console.log('>> ' + msg);
  process.exit(code);
};
mkdir(tempDir);

var buildCmd;
if (flags.get('debug')) {
  console.log('>> Debug is ON. Building meteor app for current architecture');
  buildCmd = 'meteor build --directory ' + tempDir;
} else {
  console.log('>> Building meteor app for Amazon Linux (meteor build --architecture os.linux.x86_64)');
  buildCmd = 'meteor build --architecture os.linux.x86_64 --directory ' + tempDir;
}


if (exec(buildCmd).code !== 0) {
  exit(1, 'Meteor build failed'.red);
}

cd(tempDir + '/bundle/programs');

console.log('>> Removing web.browser assets');
rm('-rf', 'web.browser');
cd('server');
console.log('>> Running npm install in server directory');
exec('npm install');

cd(tempDir + '/bundle');
console.log('>> Adding exec wrapper with environment variables & settings');

// We only want to call process.exit in debug mode. Lambda does this for us automatically and will whine
// about process exiting before completing request.
function exitCall(code) {
  if (flags.get('debug')) {
    return 'originalExit.call(process, ' + code.toString() + ');';
  }
  return '';
}
// 
var code = "exports.handler=function(event,context){var originalExit=process.exit;process.exit=function(result){context.succeed(result);" + exitCall(0) + "};process.on('uncaughtException',function(err){console.log(err.stack);context.fail(err.message);" + exitCall(1) + "});process.argv.push(event);";

// Add environment variables
for (var k in ENV) {
  code += 'process.env["' + k + '"] = ' + JSON.stringify(ENV[k]) + ';';
}

code += "try{require('./main');}catch(err){console.log(err.stack);context.fail(err.message);" + exitCall(1) + "}};";
fs.writeFileSync('exec.js', code);

if (flags.get('debug')) {
  fs.writeFileSync('debug.js', "var context = {succeed: function() {console.log('Execution succeeded:', arguments);},fail: function() {console.log('Execution failed:', arguments);}};var handler = require('./exec').handler;var evtData = null;if (process.argv.length > 2) {evtData = require('./' + process.argv[2]);}handler(evtData, context);");
  console.log('>> Debug mode is ON. You can run `node debug.js` to test your application (argument is optional json file with event data). REMEMBER: if you build it again, `meteor build` will have errors unless you first remove the lambda-bundle directory.');
  process.exit(0);
}
if (!flags.get('debug')) {
  console.log('>> Bundling Lambda function');

  if (exec('zip -r lambda.zip . > /dev/null').code !== 0) {
    exit(1, 'Archiving failed'.red);
  }

  console.log('>> Zip archive is at %s/lambda.zip', tempDir);

  if (flags.get('upload')) {
    console.log('>> Uploading archive to AWS');
    if (exec('aws lambda update-function-code --function-name ' + flags.get('function') + ' --zip-file fileb://' + tempDir + '/bundle/lambda.zip').code !== 0) {
      exit(1, 'Upload failed'.red);
    }
  } else {
    console.log('>> Upload flag is `false`, not uploading to AWS');
  }
}

exit(0, 'All done!'.green);
