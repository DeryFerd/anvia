---
"@anvia/sandbox": patch
---

Block shell interpreters by default in allow-mode command policies. The sandbox
`exec_command` tool now rejects common shell executables (`sh`, `bash`, `zsh`,
`ksh`, `dash`, `ash`, `busybox`, `fish`, `csh`, `tcsh`) when the command policy
uses `mode: "allow"`, preventing agents from bypassing command restrictions via
shell arguments like `sh -c "arbitrary command"`. Set `allowShellInterpreters:
true` in the command policy to restore the previous behavior.

The opt-in requires the boolean `true`; non-boolean values are rejected when
creating tools, including strings such as `"false"`. This applies to both
`exec_command` and `start_process`.
