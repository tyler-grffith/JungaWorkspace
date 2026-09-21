## New Workspace Feature: Code Projects with Files and Runnable Outputs

## Context

Cosmic Clock arrived as a project _type_ whose "code" lived in the repository. Tyler wanted the
opposite shape: a code project you create the way you create a graphing or spreadsheet project,
holding files you write or import, with an output that runs them.

## Tyler's Request

> When I had my agent integrate the Cosmic Clock project into my JUNGA workspace app it made Cosmic
> Clock a type of project that one can create which has a bunch of files and an interactive scene as
> an output. However that was a misunderstanding. I want instead further to be a type of project one
> can create called a code project. So create a code project just as one can create a spreadsheet or
> graphing calculator project. Such a code project can have space for files to be imported or
> created from scratch and for an output type to be opened that runs the code project.

Answered in conversation: code is a tool alongside Graphing and Spreadsheet; outputs are authored
per entry file; Cosmic Clock keeps working unchanged; files are text plus folders, stored with the
project; CodeMirror for editing; the sandbox may reach the network, with security to be revisited
when user accounts arrive.

## Conceptual gaps I, the agent, filled in

- `code` is a module id like `graph` and `sheet`, so the project form, tool filter, cards,
  breadcrumbs and the `#/project/<id>/code` route follow from the registry. `projectType: 'code'`
  stays for Cosmic Clock, relabelled "Bundled source project"; both kinds may own outputs.
- Files are one flat list whose paths carry the folders, so renaming a folder is a path rewrite.
  Bounds (100 files, 128 KB each, 512 KB total, text extensions only) keep a project inside the
  library's shared local-storage budget, and paths that traverse upward are refused.
- Running needs no server and no build step: every file but the entry becomes a `data:` URL and an
  import map redirects the project's own relative specifiers onto them. `data:` rather than `blob:`
  because the frame runs in an opaque origin, which cannot read blob URLs this document minted.
- The frame is sandboxed with `allow-scripts` and deliberately without `allow-same-origin`, so a
  project cannot read the saved library, cookies, or the page around it. Network access is allowed,
  so CDN libraries work.
- A console panel forwards `console.log`/warnings/errors out of the frame, and each module carries a
  `sourceURL` so failures name the project file rather than an encoded data URL.
- Outputs reuse the existing output model and route. A `code-run` output names an entry file; the
  Earth Clock scene output is untouched. Old libraries and backups still load.

## What details should Tyler be able to fine tune by hand?

- In Junga: files and folders, the entry file, output title/description/status/entry, attribution
  and source link; designer mode adjusts the file tree width, editor height, code text size and run
  preview height.
- For further refinement: the starter template's contents, storage bounds, which extensions count as
  text, and the console panel's shape.
- Not built, and awaiting a decision: binary assets (images, fonts, data) need storage beyond local
  storage; a build step for JSX/TypeScript or bare npm imports; multi-page links between HTML files
  inside one output; and the security posture of the sandbox once accounts exist.
