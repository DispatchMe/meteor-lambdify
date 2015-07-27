Use this to compile and upload a MeteorJS CLI application to AWS Lambda.

# Installing
```bash
$ npm install -g lambdify
```

# Prepping your Meteor App

## Requirements
Make sure you remove `meteor-platform` as a package dependency for your app and replace it with just `meteor` plus whichever packages you rely on. If you keep `meteor-platform`, or specifically `webapp`, your Lambda function will run forever (or at least until your timeout) and cost you tons of cash.

Now, since your Meteor application no longer has `webapp`, it needs a new `main` function. In your server code, make sure you define a global `main` function that takes `argv` as its singular argument. The value that this function returns will be passed to Lambda's `context.succeed`, and any error that this function throws will be passed to Lambda's `context.fail`.

You can install any package you want (as long as they don't rely on `webapp`) and use them normally inside of your `main` function.

## Development
If you just run `meteor` inside of your project folder, it'll keep dying with `Exit code 0` until it realizes that your app is "crashing". By default, Meteor expects to be running a web application so it assumes your process will be long-running. However, you can tell Meteor to only run it once by using the `--once` flag, like so: `meteor --once`.

## Accessing the Lambda Event object
The `event` argument passed to the Lambda handler is appended to `process.argv`. When running in the Lambda environment, there are no arguments passed to the process, so the `event` will be the lone element in `argv`. So, you can access it like so in your `main` function:

```javascript
main = function(argv) {
  var event = argv[0];
  console.log('Event data:', event);
  return 'Got event!';
};
```

# Deploying to Lambda
## Create the Lambda function in AWS
This script will not create the Lambda function for you - this is intentional, because we don't want to make assumptions about the instance size, timeout, etc. When you create it, make sure you set the following options:

1. **Runtime**: "nodejs"
2. **Handler**: "exec.handler"
3. **Timeout**: At least 4 seconds. From our testing, it takes around 3 seconds to boot the Meteor application and reach your `main`.

## Deploy your function
Run `lambdify` inside of your project root. This script assumes that you already have the `awscli` [installed](http://docs.aws.amazon.com/cli/latest/userguide/installing.html) AND authenticated (IE, have `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set in environment variables) on your system. It runs `aws lambda update-function-code` with the compiled and zipped code.

### Flags
The following flags are available:

#### Function Name (`--function`)
The name of your AWS Lambda function

#### Environment Variables (`--env`)
Set an environment variable inside of your Lambda function (this works by dynamically generating the execution wrapper and setting variables on `process.env` prior to loading the Meteor program). You can have multiple environment variables. E.g.: `--env "MONGO_URL=mongodb://mymongohost:27017/mydb" --env "SOME_OTHER_ENV=testing"`

#### Meteor Settings (`--settings`)
Similar to environment variables, but this will load a settings JSON file that you can specify to the `meteor` command with the `--settings` flag. This will read in the settings file and set it as the `METEOR_SETTINGS` environment variable. E.g. `--settings settings.development.json`

#### No Upload (`--noupload`)
Set this flag (no argument) to skip the uploading and just bundle your application in a zip archive. Useful for debugging.

### Example
```bash
$ lambdify --function MyLambdaFunction --settings settings.production.json 
/ --env "MONGO_URL=mongodb://mymongohost:27017/mydb"
/ --env "SOME_OTHER_ENV=testing" --upload
```
