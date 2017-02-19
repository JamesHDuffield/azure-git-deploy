#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");
var child_process = require('child_process');
var request = require('request');

//Get config
var FILENAME_CONFIG = './azure-git-deploy.json';

if (!checkFile(FILENAME_CONFIG)) {
    console.log(`Error: config file (${FILENAME_CONFIG}) not found.`);
    return 1;
};

var config = JSON.parse(fs.readFileSync(FILENAME_CONFIG, 'utf8'));

var DIR_BUILD = getConfigValue(config, 'buildDirectory', true);
var DIR_STAGING = getConfigValue(config, 'stagingDirectory', true);
var AZURE_SITENAME = getConfigValue(config, 'azureSiteName', true);
var AZURE_DEPLOYMENT_USERNAME = getConfigValue(config, 'azureDeploymentUsername', true);
var AZURE_DEPLOYMENT_PASSWORD = getConfigValue(config, 'azureDeploymentPassword', true);
var GIT = `https://${AZURE_DEPLOYMENT_USERNAME}:${AZURE_DEPLOYMENT_PASSWORD}@${AZURE_SITENAME}.scm.azurewebsites.net:443/${AZURE_SITENAME}.git`;
var CHECK_URL=getConfigValue(config, 'azureSiteTestUrl', false);

//Check if Git commandline is available
try {
    child_process.execSync('which git');
} catch (error) {    
    console.log('Error: Git commandline tooling not available.');
    return 1;
};

//Check if Rsync commandline is available
try {
    child_process.execSync('which rsync');
} catch (error) {    
    console.log('Error: rsync commandline tooling not available.');
    return 1;
};

//Check if we have a build directory
if (!checkDirectory(DIR_BUILD)) {
    console.log(`Error: Build directory (${DIR_BUILD}) not found.`);
    return 1;
};

//Resolve full paths
DIR_BUILD=path.resolve(DIR_BUILD);
DIR_STAGING=path.resolve(DIR_STAGING);

//Check/create staging
if (checkDirectory(DIR_STAGING)) {
    var d = path.join(DIR_STAGING, '.git');
    if (!checkDirectory(path.join(DIR_STAGING, '.git'))) {
        console.log(`Error: Staging directory (${DIR_STAGING}) exists but doesn\'t contain a Git repository. Tip: just delete the staging directory & run again.`);
        return 1;
    };
} else {
    fs.mkdirSync(DIR_STAGING);
};

//Update existing Git - or get new Git repository
if (checkDirectory(path.join(DIR_STAGING, '.git'))) {
    console.log(`### Git updating from ${GIT}`);
    execInStaging('git pull');
} else {
    console.log(`### Git getting fresh clone from ${GIT}`);
    execInStaging(`git clone ${GIT} .`);
};
console.log();

// Sync dist -> staging
console.log('### syncing changes (build -> staging)');
var rsyncSource = DIR_BUILD  + '/';
var rsyncTarget = DIR_STAGING;
execInStaging(`rsync -avvq --delete --exclude ".git" "${rsyncSource}" "${rsyncTarget}"`);
console.log();

// Add, commit & push changes
console.log('### Git adding changes');
var diff = execInStaging('git status --porcelain', true);
if (diff) {
    execInStaging('git add -A', DIR_STAGING);
} else {
    console.log('No changes found to add');
};
console.log();


console.log('### Git commiting changes');
var diffCached = execInStaging('git diff --cached', true);
if (!diffCached) {
    console.log('Found nothing to commit, exit');
    console.log();
    return 0;
};
var USER=process.env.USER;
//TODO: get datetime & add to commit message
var commitMsg = 'deployscript ' + USER;
execInStaging(`git commit -m "${commitMsg}"`);
console.log();

console.log('### Git pusning changes');
execInStaging('git push');
console.log();

// Check if site ok
if (CHECK_URL) {
    console.log('### Waking up & checking site');
    request(CHECK_URL, function (error, response, body) {
        if (error) {
            console.log(`Error: Site retured error (${error}), sad times.`);
        } else if (response.statusCode == 200) {
            console.log('Site returned response code 200, happy times!');
        } else {
            console.log(`Error: Site retured response !200 (${response.statusCode}), sad times.`);
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
    };
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
        throw new Error(`Error: config file doesn\'t contain value for "${property}"`);
    };
    return result;
};

function execInStaging(cmdLine, captureOutput) {
    console.log('exec: ' + cmdLine);
    //Extra safety, the staging directory should have it's own GIT repository
    if (!checkDirectory(path.join(DIR_STAGING, '.git'))) {
        //If a GIT repository is not found the only allowed command is "git clone ....."
        if (cmdLine.indexOf('git clone') !== 0) {
            throw new Error('Error: the staging directory doesn\'t contain a GIT repository. Tip: just delete the staging directory & run again.');
        };
    };
    if (captureOutput) {
        return child_process.execSync(cmdLine, {cwd: DIR_STAGING}).toString().trim();
    } else {
        return child_process.execSync(cmdLine, {cwd: DIR_STAGING, stdio:[0,1,2]});
    };
}
