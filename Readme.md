# vscode

Adds syntax highlighting, formatting, auto-completion, jump-to-definition and linting for `.prisma` files.

This plugin is designed for [Prisma 2](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5). Information about the new datamodel syntax can be found [here](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md).

## Features

- Syntax highlighting
- Auto-formatting
- Linting
- Auto-completion (_coming soon_)
- Jump-to-definition (_coming soon_)

## Install

Get the Prisma Extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma).

## Preview

![](https://imgur.com/HbufPo6.png)

## Structure

```
.
????client // Language Client
|   ????src   
|       ????extension.ts // Language Client entry point
????package.json // The extension manifest.
????server // Language Server
    ????src
        ????server.ts // Language Server entry point
```


## Development

1. Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
2. Run `yarn watch`
3. Open this repository in vscode
4. Press F5, this will run the launch config. A new file should open in the [Extension Development Host] instance of VSCode.
5. Change the language to Prisma
6. Make a change to the syntax
7. To reload, press the reload button in VSCode
   1. **Developer: Inspect TM Scopes** is helpful for debugging syntax issues
- If you want to debug the server as well use the launch configuration `Attach to Server`

## Publishing

The extension is automatically published using a [Azure Devops Personal Access Token](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) via Github actions (see `.github/workflows/publish.yml`).

Note that the personal access token is only valid for a year and will need to be renewed manually.

### Manual Publishing

To do a manual publish, please follow these steps:

1. Increment the package version
2. Update to latest pinned binary release in the [Prisma CLI's package.json](https://github.com/prisma/prisma2/blob/master/cli/prisma2/package.json) under **prisma.version**.
3. Run `yarn package`
4. Go to https://marketplace.visualstudio.com/manage/publishers/Prisma
5. Click the **••• More Actions**
6. Drag `prisma-x.x.x.vsix` into the browser and click upload.

This will take about an hour before the update is available.
