# Northeast Ohio Industry Insights setup

## Required repository secret

Add an Actions repository secret named `OPENAI_API_KEY` under:

`GitHub repository → Settings → Secrets and variables → Actions → New repository secret`

Do not place the API key in website JavaScript, HTML, source files, or commit history.

## Publishing workflow

- The workflow runs Mondays at 12:00 UTC, which is 8:00 a.m. EDT or 7:00 a.m. EST.
- It can also be run manually from the Actions tab.
- The generator researches current Northeast Ohio developments with OpenAI web search.
- Generated JSON is written to `data/regional-updates/`.
- The workflow opens a draft pull request rather than publishing directly.
- Review facts, live bid deadlines, names, regulatory statements, pricing claims, and source links.
- Merge the draft pull request to publish the briefing.

## Cost and security controls

Use a dedicated OpenAI project/API key for this workflow and set project budget alerts or limits. Rotate the key immediately if it is ever exposed.
