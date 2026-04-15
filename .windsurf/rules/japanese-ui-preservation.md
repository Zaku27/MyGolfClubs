# Japanese UI Preservation Rule
Activation Mode: Always On

This project is a Japanese web application (React + Vite + PWA).
The following rules must be **strictly followed at all times**:

- All user-facing strings (button labels, placeholders, error messages, toasts, UI text, Japanese descriptions in comments) must **remain in Japanese and absolutely never be changed**. Do not translate to English or replace them.
- Japanese string literals in code must not be touched at all and kept as-is.
- Even when instructed to change processing logic or add features, UI text parts must remain in Japanese.
- Variable names, function names, and English code parts are fine as usual, but display strings must be fixed in Japanese.
- Always prioritize "Preserve Japanese UI" as the highest constraint.

This rule is Always On for the entire project and automatically applied to all Cascade/Chat responses.
