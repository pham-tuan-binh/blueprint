---
name: blueprint-share
description: Share a finished blueprint build plan with everyone by opening a pull request that adds it to the pham-tuan-binh/blueprint repo, where it gets its own page and a card on the plans site (pham-tuan-binh.github.io/blueprint). Use it when someone wants to publish, share, submit, contribute or upload a plan they made with the blueprint skill, "add my plan to the gallery", "put my workbench on the site", or open a PR with a build plan. Needs a plan that already passes the blueprint skill's check, git, and a GitHub account.
license: MIT
compatibility: Any agent that can run shell commands with Node.js 20+ and git. The GitHub CLI (gh) makes forking and opening the PR one command each; without it the person does those two steps on github.com.
metadata:
  version: "1.0"
---

# Blueprint share

Turns a plan made with the `blueprint` skill into a pull request on [pham-tuan-binh/blueprint](https://github.com/pham-tuan-binh/blueprint). Once it is merged, the site builds the plan into its own page and puts a card for it on the landing page, credited to its author. Nothing else in the repo changes: a plan is one file, `plans/<id>/design.mjs`.

`$SHARE` below is the folder this SKILL.md is in, and `$SKILL` is the `blueprint` skill's folder (usually its sibling); write them out in full.

## What gets merged

- **Exactly one file**: `plans/<id>/design.mjs`. Not `index.html`, not `shots/`: CI builds the page from the design, and screenshots are for the author's review only.
- **It passes the audit with the repo's kit.** CI audits every plan on every pull request, so a plan that fails there cannot merge. The share script runs the same audit before anything is pushed.
- **It credits its author**: `author: { github: 'handle', name: 'Name' }` on the plan, right after `summary`. The card says "by @handle".
- **Its id is new**: lower-case words joined by dashes, not already in `plans/` or the skill's examples.
- **Its summary reads as a card description**: one or two sentences, under 320 characters, saying what it is and how it is built. It is all a visitor reads before they open it.
- It is something a person can build in a workshop, made with the skill, not a copy of an example with the numbers changed.

## Workflow

1. **Check the plan first.** It must pass the blueprint skill's full check, browser included:
   `node $SKILL/scripts/blueprint.mjs check plans/<id>/design.mjs`
   If it does not pass, fix it with the blueprint skill before going on. Read the shots: what you share is what everyone sees.
2. **Add the author** to the plan if it is not there. Ask the person for their GitHub handle; do not guess it.
   ```js
   summary: '…',
   author: { github: 'their-handle', name: 'Their Name' },
   ```
3. **Fork and clone the repo** (once). With the GitHub CLI:
   ```bash
   gh auth status || gh auth login
   gh repo fork pham-tuan-binh/blueprint --clone     # makes ./blueprint, with origin = their fork
   ```
   Without it, have the person fork on github.com (the Fork button), then `git clone https://github.com/<handle>/blueprint`. If they already have a clone, bring it up to date: `git -C blueprint pull https://github.com/pham-tuan-binh/blueprint main`.
4. **Run the share script.** It copies the plan in, audits it with the repo's kit, builds the site to confirm the page and card appear, and writes the PR text:
   ```bash
   node $SHARE/scripts/share.mjs plans/<id>/design.mjs --repo blueprint
   ```
   It must end with `ready.` and print the next commands. Exit 1 means the plan fails in the repo: fix it with the blueprint skill and run it again. If the audit passes locally but fails here, the repo's kit is newer than the installed skill: update the skill (`npx skills add pham-tuan-binh/blueprint`) and recheck. Updating a plan you shared before: add `--update`.
5. **Show the person what will be sent** (the file and the PR text) and get their go-ahead. A pull request is public.
6. **Branch, commit, push and open the PR** with the commands the script printed:
   ```bash
   cd blueprint
   git checkout -b plan/<id>
   git add plans/<id>/design.mjs
   git commit -m "Add plan: <name>"
   git push -u origin plan/<id>
   gh pr create --repo pham-tuan-binh/blueprint --head <handle>:plan/<id> --title "Add plan: <name>" --body-file .git/blueprint-pr-<id>.md
   ```
   Without gh: open the fork on github.com, "Contribute" > "Open pull request", and paste the PR text.
7. **Tell the person** the PR link, that CI audits it and builds the site, and the address it will have once merged: `https://pham-tuan-binh.github.io/blueprint/<id>/`. If CI fails, read the failing step's log, fix the plan, and push to the same branch.

## Rules

- Never push to `pham-tuan-binh/blueprint` itself or to its `main`: always a branch on the person's fork, then a pull request.
- Never change anything outside `plans/<id>/` in a share PR (not the kit, not the site, not another plan). A kit fix is a separate PR with its own reason.
- Never edit a check or loosen a field range to get a plan through the audit; fix the design.
- Never commit, push or open the PR before the person has seen what will be sent.
