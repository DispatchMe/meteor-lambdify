This is a bash script that compiles and modifies a Meteor application for running as an AWS Lambda function.

# Install
Tested on a mac:

1. `git clone git@github.com:Dispatchme/meteor-lambdify`
2. `cd meteor-lambdify`
3. `sudo cp lambdify /usr/local/bin/`
4. `sudo chmod +x /usr/local/bin/lambdify`

# Requirements
Make sure you remove `meteor-platform` as a package dependency for your app and replace it with just `meteor` plus whichever packages you rely on. If you keep `meteor-platform`, or specifically `webapp`, your Lambda function will run forever (or at least until your timeout) and cost you tons of cash.

Now, since your Meteor application no longer has `webapp`, it needs a new `main` function. In your server code, make sure you define a global `main` function that takes `argv` as its singular argument. The value that this function returns will be passed to Lambda's `context.succeed`, and any error that this function throws will be passed to Lambda's `context.fail`.

You can install any package you want (as long as they don't rely on `webapp`) and use them normally inside of your `main` function.

# Development
If you just run `meteor` inside of your project folder, it'll keep dying with `Exit code 0` until it realizes that your app is "crashing". By default, Meteor expects to be running a web application so it assumes your process will be long-running. However, you can tell Meteor to only run it once by using the `--once` flag, like so: `meteor --once`.

# Accessing the Lambda Event object`
The `event` argument passed to the Lambda handler is appended to `process.argv`. When running in the Lambda environment, there are no arguments passed to the process, so the `event` will be the lone element in `argv`. So, you can access it like so in your `main` function:

```javascript
main = function(argv) {
  var event = argv[0];
  console.log('Event data:', event);
  return 'Got event!';
};
```

# Deploying
## Create the Lambda function in AWS
This script will not create the Lambda function for you - this is intentional, because we don't want to make assumptions about the instance size, timeout, etc. When you create it, make sure you set the following options:

1. **Runtime**: "nodejs"
2. **Handler**: "exec.handler"
3. **Timeout**: At least 4 seconds. From our testing, it takes around 3 seconds to boot the Meteor application and reach your `main`.

## Deploy your function
Run `lambdify` inside of your project. If you do not provide an argument, it will assume that the Lambda function is named the same as the folder you are in. Otherwise, you can run `lambdify {function-name}`.

This script assumes that you already have the `awscli` [installed](http://docs.aws.amazon.com/cli/latest/userguide/installing.html) AND authenticated on your system. It runs `aws lambda update-function-code` with the compiled and zipped code.
