
* !!! DEPRECATED !!!

replaced by: https://github.com/gitdude49/azure-site-deploy !!!

* !!! DEPRECATED !!!

# azure-git-deploy
Npm module to quickly perform a Git WebSite/WebApp deployment

## External dependencies
At the moment this program requires two external dependencies:
- rsync
- git

## Install
Global install:

`npm install -g azure-git-deploy`

Local install:

`npm install --save-dev azure-git-deploy`


## Required configuration file
Create a file **azure-git-deploy.json**. It should have values for:
- buildDirectory

The directory containing the content that needs to be deployed to the Azure WebApp

- stagingDirectory

The directory where this program can have it's staging content

- azureSiteName

The Azure WebApp name we need to deploy for

- azureSiteTestUrl

[Optional] The url that needs to be checked after a deployment has been perdormed

- azureDeploymentUsername
The Git deployment username*

- azureDeploymentPassword
The Git deployment password*

## Example Configuration
Filename: azure-git-deploy.json
~~~~
{
    "buildDirectory": "bin/Debug/netcoreapp1.1/publish",
    "stagingDirectory": "dist.deploy.azure",

    "azureSiteName": "myazure-website",
    "azureSiteTestUrl": "http://myazure-website.azurewebsites.net/index.html",

    "azureDeploymentUsername": "superSecretUsername",
    "azureDeploymentPassword": "pasPas!129"
}
~~~~

## Run
When azure-git-deploy has been installed globally:
- Perform the project specific build for your project, this should produce output in **buildDirectory**
- Run **azure-git-deploy**
```
azure-git-deploy
```

When azure-git-deploy has been installed locally:

Add **azure-git-deploy** to one of the scripts in your **package.json**
```
{
  ... other content in package.json not shown here
  "scripts": {
    "deploy": "dotnet publish && azure-git-deploy"
  }
}
```

## * Azure WebApp configuration for GIT deployment 
Enable "Local GIT" deployment on your Azure WebApp

Also: set "Deployment credentials" for your Azure GIT/FTP deployments. Note: The Azure "Deployment credentials" are a subscription wide setting

