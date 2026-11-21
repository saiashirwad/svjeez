A svjeez scene already exists at {{dir}}/index.tsx. It was built from this spec ({{task}}):

{{spec}}

Edit that scene in place to make this change:

{{change}}

How to work:

- Read .claude/skills/svjeez/SKILL.md first and follow its check workflow.
- Bash allows only bun, bunx and read-only commands (ls, cat, head, tail, wc, find, grep, rg); change files with Write and Edit, not sed.
- Write only inside {{dir}}/. Keep everything the change does not mention working as before.
- Check the scene and look at its frames until it is clean and matches the spec plus the change.
- Finish with a one-paragraph report: what you changed, what you checked, what is still imperfect.
