#!/usr/bin/env node

require('shelljs/global');

var flags = require('flags'),
  fs = require('fs');
require('colors');

flags.defineString('function', '', 'Name of the Lambda function');
flags.defineMultiString('env', '', 'Environment variable to set in entry point. E.g. MONGO_URL');
flags.defineString('settings', '', 'Settings file to parse and set as the METEOR_SETTINGS environment variable in the entry point. E.g. "settings.development.json"');

flags.defineBoolean('upload', true, 'Whether to upload the bundle to Lambda');

flags.parse();

var ENV = {};

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



var tempDir = '/tmp/mteor_lambda_' + (new Date()).toISOString();

var exit = function(code, msg) {
  if (flags.get('upload')) {
    rm('-rf', tempDir);
  }

  console.log('>> ' + msg);
  process.exit(code);
};
mkdir(tempDir);

console.log('>> Building meteor app for Amazon Linux (meteor build --architecture os.linux.x86_64)');

if (exec('meteor build --architecture os.linux.x86_64 --directory ' + tempDir).code !== 0) {
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


var code = "exports.handler=function(event,context){process.exit=function(result){context.succeed(result);};process.argv.push(event);";

// Add environment variables
for (var k in ENV) {
  code += 'process.env["' + k + '"] = ' + JSON.stringify(ENV[k]) + ';';
}

code += "try{require('./main');}catch(err){context.fail(err);}};";
fs.writeFileSync('exec.js', code);


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
exit(0, 'All done!'.green);
