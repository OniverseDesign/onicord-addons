# Official Onicord Addons Repository

Official and community addons registry for **Onicord**.

## Repository Structure

- `index.json`: Central addon catalog registry.
- `build.js`: Compiler script to package addons into `.onimod` bundles and update `index.json`.
- `plugins/`: Compiled distribution packages organized by addon ID.

## How to Create and Build an Addon

1. Create a directory inside this repository containing your addon source code:
   ```text
   my-addon/
   ├── manifest.json
   ├── index.js
   └── assets/
       └── icon.png
   ```

2. Run the build script to compile your addon:
   ```bash
   node build.js
   ```
   *(or `npm run build` / `npm run pack`)*

3. The script will automatically generate the distribution package at `plugins/<addon-id>/package.onimod` and register your addon in `index.json`.

4. Submit a Pull Request or push your changes to the repository.
