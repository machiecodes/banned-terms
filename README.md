# Banned Terms
Automatically close issues that contain certain keywords. Created after observing 
the issues of a popular minecraft client's repository and being physically drained 
by the number of hapless 13-year-olds asking for a complete rewrite of the mod to 
the "Forge" modloader. If you have common, unrealistic things people constantly open
issues about, this could be your solution!

### Example Usage:
```.github/workflows/example.yml```
```
name: "Issue Moderator"

on:
  issues:
    types: [opened]

jobs:
  test_action:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Banned Terms
        uses: machiecodes/banned-terms@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          banned-terms: |
            Forge
            Port
            Feather Client
            Labymod
            Optifine
          close-label: "invalid"
```
