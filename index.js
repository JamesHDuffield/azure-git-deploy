#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");
var child_process = require('child_process');
var request = require('request');

//Get config
var FILENAME_CONFIG = './azure-git-deploy.json';

if (!checkFile(FILENAME_CONFIG)) {
    console.log('Error: config file (' + FILENAME_CONFIG + ') not found.');
    return 1;
};

var config = JSON.parse(fs.readFileSync(FILENAME_CONFIG, 'utf8'));

var DIR_BUILD = getConfigValue(config, 'buildDirectory', true);
var DIR_STAGING = getConfigValue(config, 'stagingDirectory', true);
var AZURE_SITENAME = getConfigValue(config, 'azureSiteName', true);
var AZURE_DEPLOYMENT_USERNAME = getConfigValue(config, 'azureDeploymentUsername', true);
var AZURE_DEPLOYMENT_PASSWORD = getConfigValue(config, 'azureDeploymentPassword', true);
var GIT = 'https://' + AZURE_DEPLOYMENT_USERNAME + ':' + AZURE_DEPLOYMENT_PASSWORD + '@' + AZURE_SITENAME + '.scm.azurewebsites.net:443/' + AZURE_SITENAME + '.git';
var CHECK_URL=getConfigValue(config, 'azureSiteTestUrl', false);

//Check if Git commandline available
try {
    child_process.execSync('which git');
} catch (error) {    
    console.log('Error: Git commandline tooling not available.');
    return 1;
};

//Check if Rsync commandline available
try {
    child_process.execSync('which rsync');
} catch (error) {    
    console.log('Error: rsync commandline tooling not available.');
    return 1;
};

//Check if we have a build directory
if (!checkDirectory(DIR_BUILD)) {
    console.log('Error: Build directory (' + DIR_BUILD + ') not found.');
    return 1;
};

//Check/create staging
if (checkDirectory(DIR_STAGING)) {
    var d = path.join(DIR_STAGING, '.git');
    if (!checkDirectory(path.join(DIR_STAGING, '.git'))) {
        console.log('Error: Staging directory (' + DIR_STAGING + ') exists but doesn\'t contain a Git repository. Tip: just delete the staging directory & run again.');
        return 1;
    };
} else {
    fs.mkdirSync(DIR_STAGING);
};

DIR_BUILD=path.resolve(DIR_BUILD);
DIR_STAGING=path.resolve(DIR_STAGING);

//Update existing Git - or get new Git repository
if (checkDirectory(path.join(DIR_STAGING, '.git'))) {
    console.log('### Git updating from ' + GIT);
    child_process.execSync('git pull', {cwd: DIR_STAGING, stdio:[0,1,2]});
} else {
    console.log('### Git getting fresh clone from ' + GIT);
    child_process.execSync('git clone ' + GIT  + ' .', {cwd: DIR_STAGING, stdio:[0,1,2]});
};
console.log();

// Sync dist -> staging
console.log('### syncing changes (build -> staging)');
child_process.execSync('rsync -avvq ' + DIR_BUILD  + '/ ' + DIR_STAGING, {cwd: DIR_STAGING, stdio:[0,1,2]});
console.log();

// Add, commit & push changes
console.log('### Git adding changes');
if (child_process.execSync('git diff', {cwd: DIR_STAGING}).toString().trim()) {
    child_process.execSync('git add -A', {cwd: DIR_STAGING, stdio:[0,1,2]});
} else {
    console.log('No changes found to add');
};
console.log();


console.log('### Git commiting changes');
if (!child_process.execSync('git diff --cached', {cwd: DIR_STAGING}).toString().trim()) {
    console.log('Found nothing to commit, exit');
    return 0;
};
var USER=process.env.USER;
//TODO: get datetime & add to commit message
var commitMsg = 'deployscript ' + USER;
child_process.execSync('git commit -m "' + commitMsg + '"', {cwd: DIR_STAGING, stdio:[0,1,2]});
console.log('');

console.log('### Git pusning changes');
child_process.execSync('git push', {cwd: DIR_STAGING, stdio:[0,1,2]});
console.log();

// Check if site ok
if (CHECK_URL) {
    console.log('### Waking up & checking site');
    request(CHECK_URL, function (error, response, body) {
        if (error) {
            console.log('Error: Site retured error (' + error + '), sad times.');
        } else if (response.statusCode == 200) {
            console.log('Site returned response code 200, happy times!');
        } else {
            console.log('Error: Site retured response !200 (' + response.statusCode + '), sad times.');
        };
        console.log();
    });
};

function checkDirectory(dir) {
    try {
        var stat = fs.statSync(dir);
        return stat.isDirectory();
    } catch (error) {
        return false;
    }
};

function checkFile(file) {
    try {
        var stat = fs.statSync(file);
        return stat.isFile();
    } catch (error) {
        return false;
    };
};

function getConfigValue(config, property, required) {
    var result = config[property];
    if (required && (!result || typeof result !== 'string')) {
        throw new Error('Error: config file doesn\'t contain value for "' + property + '"');
    };
    return result;
};
