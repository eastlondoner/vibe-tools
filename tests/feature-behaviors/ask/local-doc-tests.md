# Feature Behavior: --with-doc Local File Path Support (ask command)

## Description
Validates that vibe-tools `ask` command correctly loads and uses local filesystem documents provided via the `--with-doc` parameter. Both relative paths and `file://` URLs should be supported.

## Test Scenarios

### Scenario 1: Relative path (Happy Path)
**Task Description:**
Use vibe-tools to answer the question "What features are listed in the local doc?". The local Markdown document is provided via the `--with-doc` parameter using a relative path: `{{path:sample-doc.md}}`.

**Expected Behavior:**
- The AI agent chooses the `vibe-tools ask` command.
- The command includes `--with-doc=./sample-doc.md` (or an equivalent resolved relative path).
- The command completes without errors.
- The answer lists the bullet-point features from the document.

**Success Criteria:**
- PASS if the answer contains at least the words "Local file support" **and** "Absolute path support" (case-insensitive).
- The command runs in ≤ 30 s.

### Scenario 2: file:// URL (Happy Path)
**Task Description:**
Use vibe-tools to answer "Which URL scheme is mentioned in the document?". The same Markdown document is supplied with a `file://` URL: `file://{{path:sample-doc.md}}`.

**Expected Behavior:**
- The AI agent selects `vibe-tools ask`.
- The command includes the exact `file://` URL.
- The command finishes successfully.
- The answer should mention "file:// URL support".

**Success Criteria:**
- PASS if the answer explicitly contains "file:// URL support".
- The command runs in ≤ 30 s. 