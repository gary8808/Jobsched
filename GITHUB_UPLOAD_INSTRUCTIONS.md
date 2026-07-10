# GitHub upload instructions

Upload the extracted contents of this folder to your GitHub repository.

Your repo should contain these items at the top level:

```text
.github
src
GITHUB_UPLOAD_INSTRUCTIONS.md
README.md
index.html
package.json
vite.config.js
```

If GitHub or your computer will not let you upload `.github`, manually create this file in GitHub:

```text
.github/workflows/deploy.yml
```

Then paste in the contents from the included deployment file.

After upload:

1. Go to Settings.
2. Go to Pages.
3. Set Source to GitHub Actions.
4. Go to Actions and wait for the deployment workflow to finish.
5. Open the published GitHub Pages URL.
