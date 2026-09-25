# Automation extensions

Disabled-by-default product extensions for automation schedules. This feature
adds multi-time RRULE handling and eagerly exposes the `automation_update`
tool. Neither change is Linux runtime compatibility code.

Enable it in `linux-features/features.json` only when both product extensions
are wanted:

```json
{ "enabled": ["automation-extensions"] }
```

The feature patches current upstream webview assets and therefore may require
an update when those private bundle shapes change. Validate it with:

```bash
node --test linux-features/automation-extensions/test.js
```
