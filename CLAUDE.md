# The Blueprint: working rules

- Today's plan (`buildStudyPlanCore` in index.html) is shared state. Before pushing any change to it, run `node tools/plan-check.js` and the inline-script syntax check. Both must pass.
- A plan step is either automatic (it has `need` and `have`, and is done when `have >= need`) or explicitly manual (it has `manual: true`, with a Mark done button). Do not add a new manual step for an activity the app can count. Count it from the work itself.
- Each answer counts toward a plan step only if it came from that step's own activity. A review of missed questions counts only for the missed step. A walk-through counts only for its own step. A plan step's title must describe what its Start actually opens.
- Bump BUILD_ID in index.html, build.json and /home/claude/build.json for every push.
