# Branching Strategy for Workbench

## Branch Overview

- **`master`** - Production-ready code with official releases (v0.1.x)
- **`v2-dev`** - Active development branch for V2 features
- **Feature branches** - Optional branches for specific features (merge into v2-dev)

## Working on V2 Without Creating Releases

### 1. Development Work
- All V2 work happens on `v2-dev` branch
- Version stays at `2.0.0-dev` (or similar dev suffix) during development
- Commit and push to `v2-dev` freely without triggering releases

### 2. When Ready for Beta Testing
```bash
# Update version to beta
npm version 2.0.0-beta.1 --no-git-tag-version
git commit -am "Version 2.0.0-beta.1"
npm run package  # Creates beta build
```

### 3. When Ready for Official V2 Release
```bash
# Ensure all tests pass and code is ready
npm version 2.0.0 --no-git-tag-version
git commit -am "Release v2.0.0"
git tag v2.0.0
npm run package  # Creates official release

# Merge to master
git checkout master
git merge v2-dev
git push origin master --tags
```

## Quick Commands

### Switch between branches
```bash
git checkout master      # Switch to production branch
git checkout v2-dev      # Switch to V2 development
```

### Create a feature branch
```bash
git checkout -b feature/my-feature v2-dev
# ... make changes ...
git checkout v2-dev
git merge feature/my-feature
```

## Version Numbering

- **Development**: `2.0.0-dev`, `2.1.0-dev`
- **Beta/Testing**: `2.0.0-beta.1`, `2.0.0-beta.2`
- **Release Candidates**: `2.0.0-rc.1`, `2.0.0-rc.2`
- **Official Release**: `2.0.0`, `2.1.0`

## Important Notes

- Only run `npm run package` when intentionally creating a build
- Keep version suffix `-dev` during active development to avoid confusion
- Tag commits only for official releases
- The `master` branch remains stable for v0.1.x bug fixes if needed
